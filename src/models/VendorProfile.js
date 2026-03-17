import mongoose from "mongoose";

const vendorProfileSchema = new mongoose.Schema(
  {
    vendorCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    categories: { type: [String], default: [] },
    contactName: String,
    phone: String,
    email: String,
    address: String,
    gstNumber: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const VendorProfile = mongoose.model("VendorProfile", vendorProfileSchema);
