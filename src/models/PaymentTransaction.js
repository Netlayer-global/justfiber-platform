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

paymentTransactionSchema.post("save", async function(doc) {
  if (doc.status === "success") {
    try {
      const Customer = mongoose.model("Customer");
      const FranchiseProfile = mongoose.model("FranchiseProfile");
      const FranchiseCommission = mongoose.model("FranchiseCommission");

      // Check if commission already exists for this paymentId
      const exists = await FranchiseCommission.findOne({ paymentId: doc.transactionId, type: "commission" }).lean();
      if (exists) return;

      const customer = await Customer.findOne({ customerId: doc.customerId }).lean();
      if (!customer || !customer.zoneCode) return;

      const franchise = await FranchiseProfile.findOne({ franchiseCode: customer.zoneCode }).lean();
      if (!franchise || !franchise.commissionPercent) return;

      const commissionAmount = (doc.amount * franchise.commissionPercent) / 100;

      await FranchiseCommission.create({
        franchiseCode: franchise.franchiseCode,
        invoiceId: doc.invoiceId,
        paymentId: doc.transactionId,
        customerId: doc.customerId,
        type: "commission",
        amount: commissionAmount,
        commissionPercent: franchise.commissionPercent,
        totalInvoiceAmount: doc.amount,
        notes: `Commission credit (${franchise.commissionPercent}%) for customer payment ${doc.transactionId}`
      });
    } catch (error) {
      console.error("Failed to automatically process franchise commission split hook:", error);
    }
  }
});

export const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);
