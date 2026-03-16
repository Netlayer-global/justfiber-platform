import { pathToFileURL } from "node:url";

function getBaseUrl() {
  return process.env.CUSTOMER_TEST_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function requestJson({ method = "GET", path, token, body, expectedStatus = 200 }) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
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

function printPass(label, details) {
  console.log(`[PASS] ${label}${details ? ` (${details})` : ""}`);
}

async function runCustomerFeaturesTest() {
  const mobile = process.env.TEST_CUSTOMER_MOBILE || "9876543210";
  const otpResponse = await requestJson({
    method: "POST",
    path: "/api/v1/customer/auth/send-otp",
    body: { mobile }
  });
  const otp = otpResponse.data.demoOtp;
  const login = await requestJson({
    method: "POST",
    path: "/api/v1/customer/auth/verify-otp",
    body: { mobile, otp }
  });
  const token = login.data.accessToken;
  printPass("Customer login", mobile);

  await requestJson({ path: "/api/v1/customer/wifi", token });
  printPass("Customer Wi-Fi info");

  await requestJson({
    method: "POST",
    path: "/api/v1/customer/wifi/pause",
    token,
    body: { paused: true }
  });
  printPass("Customer pause Wi-Fi");

  await requestJson({
    method: "POST",
    path: "/api/v1/customer/wifi/guest",
    token,
    body: { enabled: true, ssid: "JustFiber-Guest", password: "Guest123" }
  });
  printPass("Customer guest Wi-Fi");

  await requestJson({
    method: "POST",
    path: "/api/v1/customer/wifi/parental-controls",
    token,
    body: { mode: "append", rules: [{ targetName: "Kids Tablet", blocked: true, startTime: "22:00", endTime: "06:00" }] }
  });
  printPass("Customer parental control");

  await requestJson({
    method: "POST",
    path: "/api/v1/customer/device/access-control",
    token,
    body: { clientId: "tv-living", blocked: true }
  });
  printPass("Customer device block");

  await requestJson({ path: "/api/v1/customer/network/speed-test", token });
  printPass("Customer speed test");

  await requestJson({ path: "/api/v1/customer/network/quality", token });
  printPass("Customer network quality");

  await requestJson({
    method: "POST",
    path: "/api/v1/customer/plan/change/apply",
    token,
    body: { planCode: process.env.TEST_CUSTOMER_PLAN_CODE || "PLAN-200", effectiveMode: "immediate" }
  });
  printPass("Customer plan change apply");

  await requestJson({ path: "/api/v1/customer/ott/options", token });
  printPass("Customer OTT options");

  console.log("\nCustomer feature test summary:");
  console.log("- customer self-care actions: OK");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCustomerFeaturesTest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
