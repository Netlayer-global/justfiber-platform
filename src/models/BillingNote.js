import mongoose from "mongoose";

const billingNoteSchema = new mongoose.Schema(
  {
    noteNumber: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["credit", "debit"], required: true, index: true },
    customerId: { type: String, required: true, index: true },
    serviceId: { type: String, index: true },
    invoiceId: { type: String, index: true },
    reasonCode: { type: String, index: true },
    note: String,
    amount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["issued", "applied", "cancelled"], default: "applied", index: true },
    taxMode: { type: String, default: "india_gst" },
    taxBreakdown: {
      type: [
        new mongoose.Schema(
          {
            label: String,
            rate: Number,
            amount: Number
          },
          { _id: false }
        )
      ],
      default: []
    },
    createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    metadata: mongoose.Schema.Types.Mixed,
    issuedAt: { type: Date, default: Date.now, index: true },
    appliedAt: Date
  },
  { timestamps: true }
);

billingNoteSchema.index({ customerId: 1, issuedAt: -1 });

export const BillingNote = mongoose.model("BillingNote", billingNoteSchema);
