import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function getBaseUrl() {
  return process.env.BILLING_TEST_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;
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

function requireDemoOtp(payload, path) {
  const otp = payload?.data?.demoOtp;
  if (!otp) {
    throw new Error(`${path} did not expose demoOtp. Set EXPOSE_DEMO_OTP=true for local scripted OTP login tests.`);
  }
  return otp;
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loginAdmin() {
  const payload = await requestJson({
    method: "POST",
    path: "/api/v1/admin/auth/login",
    body: {
      login: process.env.BILLING_TEST_ADMIN_LOGIN || process.env.SEED_SUPERADMIN_USERNAME || "admin",
      password: process.env.BILLING_TEST_ADMIN_PASSWORD || process.env.SEED_SUPERADMIN_PASSWORD || "Netlayer@1411"
    }
  });
  const token = payload.data?.accessToken || "";
  expect(token, "Missing admin access token");
  printPass("Admin login");
  return token;
}

async function loginCustomer(mobile) {
  const otpResponse = await requestJson({
    method: "POST",
    path: "/api/v1/customer/auth/send-otp",
    body: { mobile }
  });
  const otp = requireDemoOtp(otpResponse, "/api/v1/customer/auth/send-otp");
  const login = await requestJson({
    method: "POST",
    path: "/api/v1/customer/auth/verify-otp",
    body: { mobile, otp }
  });
  const token = login.data?.accessToken || "";
  expect(token, `Missing customer access token for ${mobile}`);
  printPass("Customer login", mobile);
  return token;
}

async function verifyCustomerBilling({ mobile, expectedDueState }) {
  const token = await loginCustomer(mobile);
  const summary = await requestJson({
    path: "/api/v1/customer/billing/summary",
    token
  });
  const details = await requestJson({
    path: "/api/v1/customer/billing/details",
    token
  });
  const summaryData = summary.data || {};
  const detailsData = details.data || {};
  expect(typeof summaryData.dueAmount === "number", `Customer billing summary missing numeric dueAmount for ${mobile}`);
  expect(typeof detailsData.summary?.invoiceLifecycle === "string", `Customer billing details missing invoiceLifecycle for ${mobile}`);
  expect(Array.isArray(detailsData.invoices), `Customer billing details invoices missing for ${mobile}`);
  if (detailsData.invoices.length > 0) {
    expect(
      typeof detailsData.invoices[0].lifecycleStatus === "string",
      `Customer billing invoice lifecycleStatus missing for ${mobile}`
    );
  }
  if (expectedDueState === "clear") {
    expect(Number(summaryData.dueAmount || 0) === 0, `Expected clear due for ${mobile} but found ${summaryData.dueAmount}`);
  }
  if (expectedDueState === "overdue") {
    expect(Number(summaryData.dueAmount || 0) > 0, `Expected due amount for ${mobile}`);
    expect(
      ["pending", "overdue"].includes(String(summaryData.paymentStatus || "").toLowerCase()),
      `Expected pending/overdue paymentStatus for ${mobile}`
    );
  }
  printPass("Customer billing summary/details", `${mobile} -> ${summaryData.paymentStatus || detailsData.summary?.invoiceLifecycle || "unknown"}`);
}

async function verifyAdminBilling(adminToken) {
  const workbench = await requestJson({
    path: "/api/v1/admin/billing/collections/workbench",
    token: adminToken
  });
  expect(Array.isArray(workbench.data?.items), "Billing collections workbench missing items array");
  expect(
    workbench.data?.totals && typeof workbench.data.totals.totalDueAmount === "number",
    "Billing workbench missing totals summary"
  );
  printPass("Admin billing workbench", `${workbench.data.items.length} items`);

  const preview = await requestJson({
    method: "POST",
    path: "/api/v1/admin/billing/collections/bulk-preview",
    token: adminToken,
    body: { customerIds: (workbench.data.items || []).slice(0, 2).map((item) => item.customerId).filter(Boolean) }
  });
  expect(typeof preview.data?.selectedAccounts === "number", "Bulk preview missing selectedAccounts");
  expect(preview.data?.counts && typeof preview.data.counts.remind === "number", "Bulk preview missing action counts");
  printPass("Billing bulk preview", `${preview.data.selectedAccounts} selected`);

  const reconciliation = await requestJson({
    path: "/api/v1/admin/billing/reconciliation/summary",
    token: adminToken
  });
  expect(typeof reconciliation.data?.unreconciledCount === "number", "Reconciliation summary missing unreconciledCount");
  printPass("Billing reconciliation summary", String(reconciliation.data.unreconciledCount));

  const resolutions = await requestJson({
    path: "/api/v1/admin/billing/finance/resolutions",
    token: adminToken
  });
  expect(typeof resolutions.data?.totals?.waivers === "number", "Finance resolutions missing waiver totals");
  printPass("Billing finance resolutions");

  const customerBilling = await requestJson({
    path: "/api/v1/admin/customers/CUST-1002/billing",
    token: adminToken
  });
  expect(customerBilling.data?.controlCenter, "Customer billing control center missing");
  expect(typeof customerBilling.data.controlCenter.dueAmount === "number", "Customer control center missing dueAmount");
  printPass("Customer billing control center", "CUST-1002");
}

async function verifySchedulerGuardrails() {
  const billingEngineSource = await readFile(new URL("../integrations/internalBillingEngine.js", import.meta.url), "utf8");
  const workerSource = await readFile(new URL("../worker.js", import.meta.url), "utf8");

  expect(
    billingEngineSource.includes("ADVANCE_INVOICE_LEAD_DAYS = 7"),
    "Billing engine no longer pins advance invoice lead time to 7 days"
  );
  expect(
    billingEngineSource.includes("addDays(nextBillingDate, -ADVANCE_INVOICE_LEAD_DAYS)"),
    "Billing engine no longer derives invoice window from next billing date"
  );
  expect(
    billingEngineSource.includes("dueDate: options.dueDate || nextBillingDate || undefined"),
    "Billing engine no longer aligns due date to next billing date"
  );
  expect(
    workerSource.includes('paymentStatus: "overdue"'),
    "Worker no longer marks pending invoices as overdue"
  );
  expect(
    workerSource.includes('"suspended"') && workerSource.includes("Auto collections suspension"),
    "Worker no longer contains automatic collections suspension flow"
  );
  expect(
    workerSource.includes("Auto resume after payment reconciliation"),
    "Worker no longer contains automatic resume after reconciliation"
  );
  printPass("Billing scheduler guardrails", "advance billing, overdue, suspend, resume");
}

async function runBillingAutomationTest() {
  const adminToken = await loginAdmin();
  await verifyAdminBilling(adminToken);
  await verifyCustomerBilling({
    mobile: process.env.BILLING_TEST_CLEAR_MOBILE || "9876543210",
    expectedDueState: "clear"
  });
  await verifyCustomerBilling({
    mobile: process.env.BILLING_TEST_OVERDUE_MOBILE || "9876543211",
    expectedDueState: "overdue"
  });
  await verifySchedulerGuardrails();

  console.log("\nBilling automation summary:");
  console.log("- admin billing workbench/reconciliation/resolution: OK");
  console.log("- customer billing summary/details lifecycle: OK");
  console.log("- scheduler guardrails for advance invoice + overdue + suspend/resume: OK");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBillingAutomationTest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
