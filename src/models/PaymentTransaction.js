import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    serviceId: { type: String, index: true },
    invoiceId: { type: String, index: true },
    provider: String,
    amount: Number,
    currency: { type: String, default: "INR" },
    status: { type: String, default: "success", index: true },
    paidAt: Date,
    method: String,
    reference: String,
    reconciliationStatus: {
      type: String,
      enum: ["pending", "matched", "manual_review", "reconciled"],
      default: "pending",
      index: true
    },
    reconciledAt: Date,
    reconciledInvoiceId: { type: String, index: true },
    reconciledByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    unallocatedAmount: { type: Number, default: 0 },
    allocations: {
      type: [
        new mongoose.Schema(
          {
            invoiceId: String,
            amount: Number,
            allocatedAt: Date,
            mode: String
          },
          { _id: false }
        )
      ],
      default: []
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

paymentTransactionSchema.index({ customerId: 1, paidAt: -1 });
paymentTransactionSchema.index({ status: 1, paidAt: -1 });

export const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);
