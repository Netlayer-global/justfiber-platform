import mongoose from "mongoose";

const billingProfileSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    billMode: { type: String, enum: ["prepaid", "postpaid"], default: "prepaid" },
    cycle: { type: String, enum: ["monthly", "quarterly", "annual"], default: "monthly" },
    invoiceDay: { type: Number, min: 1, max: 31, default: 1 },
    dueDays: { type: Number, min: 0, default: 0 },
    graceDays: { type: Number, min: 0, default: 0 },
    autoSuspend: { type: Boolean, default: true },
    currency: { type: String, default: "INR" },
    taxPercent: { type: Number, default: 18 },
    razorpayEnabled: { type: Boolean, default: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

billingProfileSchema.index({ active: 1, code: 1 });

export const BillingProfile = mongoose.model("BillingProfile", billingProfileSchema);
