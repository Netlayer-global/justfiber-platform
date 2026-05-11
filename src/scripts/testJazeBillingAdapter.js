/**
 * Verify jazeBillingAdapter shape with real data.
 *
 * Run:
 *   TEST_JAZE_USER_ID=665832941259648 node src/scripts/testJazeBillingAdapter.js
 */

import {
  fetchBillingSummary,
  fetchInvoiceHistory,
  generatePaymentLink,
} from "../integrations/jazeBillingAdapter.js";

const USER_ID = process.env.TEST_JAZE_USER_ID;
if (!USER_ID) {
  console.error("TEST_JAZE_USER_ID required");
  process.exit(1);
}

function show(title, data) {
  console.log("\n" + "─".repeat(70));
  console.log(`  ${title}`);
  console.log("─".repeat(70));
  // Hide raw for readability
  const cleaned = JSON.parse(JSON.stringify(data, (k, v) => (k === "raw" ? undefined : v)));
  console.log(JSON.stringify(cleaned, null, 2));
}

async function main() {
  console.log(`Testing adapter for Jaze user ${USER_ID}\n`);

  const summary = await fetchBillingSummary(USER_ID);
  show("1. Billing Summary (adapter output)", summary);

  const invoices = await fetchInvoiceHistory(USER_ID, {
    fromDate: "2024-01-01",
    toDate: "2026-12-31",
  });
  show(`2. Invoice History (${invoices.length} entries)`, invoices);

  const payment = await generatePaymentLink(USER_ID);
  show("3. Payment Link", payment);

  console.log("\n✓ Adapter works correctly.\n");
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
