import mongoose from "mongoose";

const billingLedgerEntrySchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    serviceId: { type: String, index: true },
    invoiceId: { type: String, index: true },
    paymentId: { type: String, index: true },
    category: {
      type: String,
      enum: ["invoice", "payment", "refund", "credit_adjustment", "debit_adjustment", "writeoff"],
      required: true,
      index: true
    },
    direction: { type: String, enum: ["debit", "credit"], required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    balanceAfter: Number,
    reference: String,
    note: String,
    source: { type: String, default: "system", index: true },
    createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    metadata: mongoose.Schema.Types.Mixed,
    postedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

billingLedgerEntrySchema.index({ customerId: 1, postedAt: -1 });
billingLedgerEntrySchema.index({ category: 1, postedAt: -1 });

export const BillingLedgerEntry = mongoose.model("BillingLedgerEntry", billingLedgerEntrySchema);
