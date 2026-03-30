import { BillingInvoice } from "../models/BillingInvoice.js";
import { createLedgerEntry, applyBillingNoteAdjustment, syncCustomerBillingState } from "./billingAccounting.js";

function buildCollectionsResolutionSnapshot(customer, updates = {}) {
  return {
    ...(customer.billingSnapshot || {}),
    collections: {
      ...(customer.billingSnapshot?.collections || {}),
      ...updates
    }
  };
}

export async function applyCustomerWaiverResolution({
  customer,
  amount,
  taxAmount = 0,
  taxMode = "india_gst",
  taxBreakdown = [],
  invoiceId,
  reasonCode = "waiver",
  note = "Billing waiver approved",
  metadata = {},
  createdByAdminId,
  source = "admin_billing_waiver"
}) {
  const result = await applyBillingNoteAdjustment({
    customer,
    type: "credit",
    amount,
    taxAmount,
    taxMode,
    taxBreakdown,
    invoiceId,
    reasonCode,
    note,
    metadata: {
      ...(metadata || {}),
      resolutionType: "waiver"
    },
    createdByAdminId,
    source
  });

  const refreshedCustomer = result.customer;
  if (refreshedCustomer) {
    refreshedCustomer.billingSnapshot = buildCollectionsResolutionSnapshot(refreshedCustomer, {
      lastResolutionType: "waiver",
      lastResolutionAt: new Date(),
      lastResolutionAmount: Number(result.note?.totalAmount || amount + taxAmount),
      lastResolutionReference: result.note?.noteNumber || ""
    });
    await refreshedCustomer.save();
    await syncCustomerBillingState(refreshedCustomer.customerId, refreshedCustomer);
  }

  return result;
}

export async function applyCustomerWriteoffResolution({
  customer,
  amount,
  invoiceId,
  reference,
  note = "Billing write-off approved",
  metadata = {},
  createdByAdminId,
  source = "admin_writeoff"
}) {
  const entry = await createLedgerEntry({
    customerId: customer.customerId,
    serviceId: customer.serviceId,
    invoiceId,
    category: "writeoff",
    direction: "credit",
    amount,
    reference: reference || `WO-${Date.now()}`,
    note,
    source,
    createdByAdminId,
    metadata: {
      ...(metadata || {}),
      resolutionType: "writeoff"
    }
  });

  customer.billingSnapshot = buildCollectionsResolutionSnapshot(customer, {
    lastResolutionType: "writeoff",
    lastResolutionAt: new Date(),
    lastResolutionAmount: amount,
    lastResolutionReference: entry.entryId
  });
  await customer.save();
  await syncCustomerBillingState(customer.customerId, customer);

  if (invoiceId) {
    await BillingInvoice.updateOne(
      { invoiceId, customerId: customer.customerId },
      {
        $set: {
          "metadata.writeOffEntryId": entry.entryId,
          "metadata.writeOffAt": new Date(),
          "metadata.writeOffByAdminId": createdByAdminId
        }
      }
    );
  }

  return { ledgerEntry: entry, customer };
}
