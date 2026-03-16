import { env } from "../config/env.js";
import { jazeClient } from "../integrations/jazeClient.js";

const READ_CUSTOMER_ID = process.env.TEST_JAZE_CUSTOMER_ID || process.env.TEST_JAZE_USER_ID || "CUST-1001";
const ENABLE_WRITES = process.env.TEST_JAZE_ENABLE_WRITES === "true";

const WRITE_INPUT = {
  userId: process.env.TEST_JAZE_USER_ID || process.env.TEST_JAZE_SERVICE_ID,
  suspendReason: process.env.TEST_JAZE_SUSPEND_REASON || "integration-test-suspend",
  resumeReason: process.env.TEST_JAZE_RESUME_REASON || "integration-test-resume",
  bookingNumber: process.env.TEST_JAZE_BOOKING_NUMBER || `JF-TEST-${Date.now()}`,
  amount: Number(process.env.TEST_JAZE_PAYMENT_AMOUNT || 1),
  customerName: process.env.TEST_JAZE_PAYMENT_CUSTOMER_NAME || "Integration Test",
  mobile: process.env.TEST_JAZE_PAYMENT_MOBILE || "9000000000",
  pppoeCustomerId: process.env.TEST_JAZE_PPPOE_CUSTOMER_ID || READ_CUSTOMER_ID,
  pppoeServiceId: process.env.TEST_JAZE_PPPOE_SERVICE_ID || process.env.TEST_JAZE_SERVICE_ID,
  pppoePlanCode: process.env.TEST_JAZE_PPPOE_PLAN_CODE || "PLAN-100",
  pppoeUsername: process.env.TEST_JAZE_PPPOE_USERNAME || `jf-test-${Date.now()}`,
  pppoePassword: process.env.TEST_JAZE_PPPOE_PASSWORD || "jf-test-password"
};

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function printSkip(message) {
  console.log(`[SKIP] ${message}`);
}

function requiredWriteFields() {
  return [
    ["TEST_JAZE_USER_ID (or TEST_JAZE_SERVICE_ID)", WRITE_INPUT.userId],
    ["TEST_JAZE_PPPOE_SERVICE_ID (or TEST_JAZE_SERVICE_ID)", WRITE_INPUT.pppoeServiceId]
  ].filter(([, value]) => !value);
}

async function runStep(results, label, fn) {
  try {
    const data = await fn();
    pass(label);
    results.push({ label, ok: true, keys: Object.keys(data || {}).slice(0, 8) });
  } catch (error) {
    fail(`${label}: ${error.message}`);
    results.push({ label, ok: false, error: error.message });
  }
}

async function main() {
  if (env.MOCK_EXTERNALS) {
    throw new Error("MOCK_EXTERNALS=true. Set MOCK_EXTERNALS=false in .env before live JAZE tests.");
  }

  const results = [];

  await runStep(results, `JAZE getCustomerBilling (${READ_CUSTOMER_ID})`, async () => {
    return jazeClient.getCustomerBilling(READ_CUSTOMER_ID);
  });

  if (!ENABLE_WRITES) {
    printSkip("Write tests disabled. Set TEST_JAZE_ENABLE_WRITES=true to test suspend/resume/payment/PPPoE.");
  } else {
    const missing = requiredWriteFields();
    if (missing.length > 0) {
      throw new Error(`Missing required vars for write tests: ${missing.map(([name]) => name).join(", ")}`);
    }

    await runStep(results, `JAZE suspendService (${WRITE_INPUT.userId})`, async () => {
      return jazeClient.suspendService({
        serviceId: WRITE_INPUT.userId,
        reason: WRITE_INPUT.suspendReason,
        idempotencyKey: `suspend-${Date.now()}`
      });
    });

    await runStep(results, `JAZE resumeService (${WRITE_INPUT.userId})`, async () => {
      return jazeClient.resumeService({
        serviceId: WRITE_INPUT.userId,
        reason: WRITE_INPUT.resumeReason,
        idempotencyKey: `resume-${Date.now()}`
      });
    });

    await runStep(results, `JAZE makePayment (${WRITE_INPUT.userId})`, async () => {
      return jazeClient.createBookingPayment({
        bookingNumber: WRITE_INPUT.userId,
        amount: WRITE_INPUT.amount,
        customerName: WRITE_INPUT.customerName,
        mobile: WRITE_INPUT.mobile
      });
    });

    await runStep(results, `JAZE createPppoeUser (${WRITE_INPUT.pppoeUsername})`, async () => {
      return jazeClient.createPppoeUser({
        customerId: WRITE_INPUT.pppoeCustomerId,
        serviceId: WRITE_INPUT.pppoeServiceId,
        planCode: WRITE_INPUT.pppoePlanCode,
        username: WRITE_INPUT.pppoeUsername,
        password: WRITE_INPUT.pppoePassword
      });
    });
  }

  const failed = results.filter((item) => !item.ok).length;
  console.log("\nJAZE module test summary:");
  for (const item of results) {
    if (item.ok) {
      console.log(`- ${item.label}: OK (${item.keys.join(", ") || "no keys"})`);
    } else {
      console.log(`- ${item.label}: FAIL (${item.error})`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
