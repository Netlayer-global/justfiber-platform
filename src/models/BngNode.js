import mongoose from "mongoose";

const bngNodeSchema = new mongoose.Schema(
  {
    nodeCode: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    vendor: { type: String, enum: ["mikrotik", "juniper", "huawei", "other"], default: "mikrotik" },
    status: { type: String, enum: ["active", "planned", "disabled"], default: "active" },
    macAddress: String,
    groupName: String,
    nasIdentifier: String,
    managementIp: String,
    radiusClientIp: String,
    apiBaseUrl: String,
    useCoa: { type: Boolean, default: true },
    coaHost: String,
    coaPort: Number,
    coaSecret: String,
    enableIpAuth: { type: Boolean, default: false },
    routerOsUsername: String,
    routerOsPassword: String,
    snmpCommunity: String,
    apiPort: Number,
    wwwPort: Number,
    notes: String
  },
  { timestamps: true }
);

bngNodeSchema.index({ status: 1, vendor: 1 });

export const BngNode = mongoose.model("BngNode", bngNodeSchema);
