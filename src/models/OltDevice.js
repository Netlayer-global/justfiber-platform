import mongoose from "mongoose";

const oltDeviceSchema = new mongoose.Schema(
  {
    oltCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    vendor: { type: String, enum: ["huawei", "zte", "vsol", "nokia", "fiberhome", "bdcom", "other"], required: true },
    model: String,
    ipAddress: { type: String, required: true },
    snmpCommunity: { type: String, default: "public" },
    snmpVersion: { type: String, enum: ["2c", "3"], default: "2c" },
    snmpPort: { type: Number, default: 161 },
    // SNMPv3 credentials (optional)
    snmpV3User: String,
    snmpV3AuthProtocol: { type: String, enum: ["md5", "sha", ""], default: "" },
    snmpV3AuthKey: String,
    snmpV3PrivProtocol: { type: String, enum: ["des", "aes", ""], default: "" },
    snmpV3PrivKey: String,
    // OLT details
    totalPonPorts: { type: Number, default: 8 },
    location: {
      lat: Number,
      lng: Number
    },
    zoneCode: { type: String, index: true },
    status: { type: String, enum: ["active", "disabled", "unreachable"], default: "active", index: true },
    lastPolledAt: Date,
    lastPollStatus: { type: String, enum: ["success", "failed", "timeout"], default: "success" },
    lastPollError: String,
    // Linked network map asset
    networkMapAssetId: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const OltDevice = mongoose.model("OltDevice", oltDeviceSchema);
