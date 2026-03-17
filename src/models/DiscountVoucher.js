import mongoose from "mongoose";

const discountVoucherSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true },
    type: { type: String, enum: ["percentage", "flat"], default: "percentage" },
    value: { type: Number, required: true },
    maxDiscountAmount: Number,
    minOrderAmount: Number,
    appliesTo: { type: [String], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    validFrom: Date,
    validTo: Date,
    usageLimit: Number,
    usageCount: { type: Number, default: 0 },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const DiscountVoucher = mongoose.model("DiscountVoucher", discountVoucherSchema);
