/**
 * Jaze Billing/Invoice API probe.
 *
 * Run on server:
 *   TEST_JAZE_USER_ID=12345 node src/scripts/testJazeBilling.js
 *
 * Optional env:
 *   TEST_JAZE_INVOICE_ID=...          (test getInvoiceDetails)
 *   TEST_JAZE_FROM_DATE=YYYY-MM-DD    (default: 90 days ago)
 *   TEST_JAZE_TO_DATE=YYYY-MM-DD      (default: today)
 *
 * This script is READ-ONLY. It calls every Jaze billing endpoint and
 * pretty-prints the raw response so we can design our adapter precisely.
 */

import { jazeClient } from "../integrations/jazeClient.js";

const USER_ID = process.env.TEST_JAZE_USER_ID;
const INVOICE_ID = process.env.TEST_JAZE_INVOICE_ID || "";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const FROM_DATE = process.env.TEST_JAZE_FROM_DATE || daysAgo(90);
const TO_DATE = process.env.TEST_JAZE_TO_DATE || today();

function header(title) {
  console.log("\n" + "═".repeat(70));
  console.log("  " + title);
  console.log("═".repeat(70));
}

function show(label, value) {
  console.log(`\n── ${label} ──`);
  try {
    console.log(JSON.stringify(value, null, 2));
  } catch {
    console.log(value);
  }
}

async function safeCall(label, fn) {
  try {
    const result = await fn();
    show(label, result);
    return result;
  } catch (err) {
    console.log(`\n── ${label} ── [FAILED]`);
    console.log(err?.message || err);
    return null;
  }
}

async function main() {
  if (!USER_ID) {
    console.error("TEST_JAZE_USER_ID env var required (Jaze user_id, not JustFiber customerId)");
    process.exit(1);
  }

  header(`Probing Jaze billing APIs for user ${USER_ID}`);
  console.log(`Date range: ${FROM_DATE} → ${TO_DATE}`);

  await safeCall("1. getSingleUserDetails(userId)", () =>
    jazeClient.getSingleUserDetails(USER_ID)
  );

  await safeCall("2. getCustomerBilling(userId)  [/get_payment_details/:userId]", () =>
    jazeClient.getCustomerBilling(USER_ID)
  );

  await safeCall("3. getPaymentLink({ userId })", () =>
    jazeClient.getPaymentLink({ userId: USER_ID })
  );

  await safeCall("4. getRenewalHistory({ userId, fromDate, toDate })", () =>
    jazeClient.getRenewalHistory({ userId: USER_ID, fromDate: FROM_DATE, toDate: TO_DATE })
  );

  const allInvoices = await safeCall(
    "5. getAllInvoiceIds({ fromDate, toDate })  [account-level]",
    () => jazeClient.getAllInvoiceIds({ fromDate: FROM_DATE, toDate: TO_DATE })
  );

  // Pick an invoice id either from env or from response
  let invIdToFetch = INVOICE_ID;
  if (!invIdToFetch && allInvoices) {
    const ids =
      allInvoices?.data?.invoice_ids ||
      allInvoices?.invoice_ids ||
      allInvoices?.data ||
      allInvoices;
    if (Array.isArray(ids) && ids.length) {
      invIdToFetch = String(ids[0]?.invoice_id || ids[0]?.invoiceId || ids[0] || "");
    }
  }

  if (invIdToFetch) {
    await safeCall(`6. getInvoiceDetails(${invIdToFetch})`, () =>
      jazeClient.getInvoiceDetails(invIdToFetch)
    );
  } else {
    console.log("\n── 6. getInvoiceDetails ── [SKIP] no invoiceId available");
  }

  header("Probe complete");
  console.log("Use the JSON shapes above to design the adapter.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
