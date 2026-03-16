import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;

function logStep(status, message) {
  const marker = status === "ok" ? "[PASS]" : "[FAIL]";
  console.log(`${marker} ${message}`);
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function requestJson({ method = "GET", path, token, body, expectedStatus = 200 }) {
  const response = await fetch(`${DEFAULT_BASE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await parseResponse(response);
  if (response.status !== expectedStatus) {
    throw new Error(`${method} ${path} expected ${expectedStatus} but got ${response.status}: ${JSON.stringify(payload)}`);
  }
  if (typeof payload !== "object" || payload === null || payload.success !== true) {
    throw new Error(`${method} ${path} did not return success envelope`);
  }
  return payload;
}

async function requestText({ path, expectedContains }) {
  const response = await fetch(`${DEFAULT_BASE_URL}${path}`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  if (!text.includes(expectedContains)) {
    throw new Error(`GET ${path} response does not contain "${expectedContains}"`);
  }
}

export async function runSmokeAllModules() {
  const checks = [];

  async function run(label, fn) {
    try {
      await fn();
      checks.push({ label, ok: true });
      logStep("ok", label);
    } catch (error) {
      checks.push({ label, ok: false, error: error.message });
      logStep("fail", `${label} -> ${error.message}`);
    }
  }

  await run("Live health endpoint", async () => {
    await requestJson({ path: "/health/live" });
  });

  await run("Ready health endpoint", async () => {
    await requestJson({ path: "/health/ready" });
  });

  await run("Admin web panel", async () => {
    await requestText({ path: "/admin", expectedContains: "Netlayer Control Tower" });
  });

  await run("User web panel", async () => {
    await requestText({ path: "/user", expectedContains: "Justfiber User Panel" });
  });

  await run("Sales web panel", async () => {
    await requestText({ path: "/sales", expectedContains: "Justfiber Sales" });
  });

  await run("Customer public plans", async () => {
    await requestJson({ path: "/api/v1/customer/plans" });
  });

  await run("Customer public banners", async () => {
    await requestJson({ path: "/api/v1/customer/banners" });
  });

  await run("Customer public FAQs", async () => {
    await requestJson({ path: "/api/v1/customer/help/faqs" });
  });

  let adminToken = "";
  await run("Admin login", async () => {
    const payload = await requestJson({
      method: "POST",
      path: "/api/v1/admin/auth/login",
      body: {
        login: process.env.SMOKE_ADMIN_LOGIN || process.env.SEED_SUPERADMIN_USERNAME || "admin",
        password: process.env.SMOKE_ADMIN_PASSWORD || process.env.SEED_SUPERADMIN_PASSWORD || "Netlayer@1411"
      }
    });
    adminToken = payload.data.accessToken;
    if (!adminToken) {
      throw new Error("Missing admin access token");
    }
  });

  await run("Admin profile (/me)", async () => {
    await requestJson({ path: "/api/v1/admin/auth/me", token: adminToken });
  });

  await run("Admin executive dashboard", async () => {
    await requestJson({ path: "/api/v1/admin/dashboard/executive", token: adminToken });
  });

  await run("Admin sales overview", async () => {
    await requestJson({ path: "/api/v1/admin/sales/overview", token: adminToken });
  });

  let installerToken = "";
  await run("Installer login", async () => {
    const payload = await requestJson({
      method: "POST",
      path: "/api/v1/installer/auth/login",
      body: {
        login: process.env.SMOKE_INSTALLER_LOGIN || "9000000001",
        password: process.env.SMOKE_INSTALLER_PASSWORD || "Installer123!"
      }
    });
    installerToken = payload.data.accessToken;
    if (!installerToken) {
      throw new Error("Missing installer access token");
    }
  });

  await run("Installer dashboard", async () => {
    await requestJson({ path: "/api/v1/installer/dashboard", token: installerToken });
  });

  await run("Installer jobs", async () => {
    await requestJson({ path: "/api/v1/installer/jobs", token: installerToken });
  });

  let salesToken = "";
  await run("Sales login", async () => {
    const payload = await requestJson({
      method: "POST",
      path: "/api/v1/sales/auth/login",
      body: {
        login: process.env.SMOKE_SALES_LOGIN || "9111111111",
        password: process.env.SMOKE_SALES_PASSWORD || "Sales123!"
      }
    });
    salesToken = payload.data.accessToken;
    if (!salesToken) {
      throw new Error("Missing sales access token");
    }
  });

  await run("Sales dashboard", async () => {
    await requestJson({ path: "/api/v1/sales/dashboard", token: salesToken });
  });

  await run("Sales leads list", async () => {
    await requestJson({ path: "/api/v1/sales/leads", token: salesToken });
  });

  let customerToken = "";
  const customerIdentity = process.env.SMOKE_CUSTOMER_MOBILE || "9876543210";
  await run("Customer OTP send", async () => {
    const payload = await requestJson({
      method: "POST",
      path: "/api/v1/customer/auth/send-otp",
      body: { mobile: customerIdentity }
    });
    const otp = payload.data.demoOtp;
    if (!otp) {
      throw new Error("Missing demo OTP");
    }
    const verify = await requestJson({
      method: "POST",
      path: "/api/v1/customer/auth/verify-otp",
      body: { mobile: customerIdentity, otp }
    });
    customerToken = verify.data.accessToken;
    if (!customerToken) {
      throw new Error("Missing customer access token");
    }
  });

  await run("Customer dashboard", async () => {
    await requestJson({ path: "/api/v1/customer/dashboard", token: customerToken });
  });

  await run("Customer billing summary", async () => {
    await requestJson({ path: "/api/v1/customer/billing/summary", token: customerToken });
  });

  await run("Customer requests list", async () => {
    await requestJson({ path: "/api/v1/customer/requests", token: customerToken });
  });

  const failed = checks.filter((step) => !step.ok);
  console.log(`\nSmoke check result: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    throw new Error(`Smoke checks failed in ${failed.length} step(s)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSmokeAllModules()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
