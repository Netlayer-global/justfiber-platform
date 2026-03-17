import mongoose from "mongoose";

const franchiseProfileSchema = new mongoose.Schema(
  {
    franchiseCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    zoneCode: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    contactName: String,
    phone: String,
    email: String,
    address: String,
    payoutMode: { type: String, enum: ["bank", "wallet", "manual"], default: "bank" },
    commissionPercent: { type: Number, default: 0 },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const FranchiseProfile = mongoose.model("FranchiseProfile", franchiseProfileSchema);
