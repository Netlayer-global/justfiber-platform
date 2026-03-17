import mongoose from "mongoose";

const bngNodeSchema = new mongoose.Schema(
  {
    nodeCode: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    vendor: { type: String, enum: ["mikrotik", "juniper", "huawei", "other"], default: "mikrotik" },
    status: { type: String, enum: ["active", "planned", "disabled"], default: "active" },
    nasIdentifier: String,
    managementIp: String,
    radiusClientIp: String,
    apiBaseUrl: String,
    notes: String
  },
  { timestamps: true }
);

bngNodeSchema.index({ status: 1, vendor: 1 });

export const BngNode = mongoose.model("BngNode", bngNodeSchema);
