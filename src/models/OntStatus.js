import mongoose from "mongoose";

const ontStatusSchema = new mongoose.Schema(
  {
    oltCode: { type: String, required: true, index: true },
    ponPort: { type: Number, required: true, index: true },
    ontIndex: { type: Number, required: true },
    serialNumber: { type: String, index: true },
    description: String,
    // Status
    onlineStatus: { type: String, enum: ["online", "offline", "dying_gasp", "unknown"], default: "unknown", index: true },
    lastOnlineAt: Date,
    lastOfflineAt: Date,
    // Optical power
    rxPower: Number, // dBm (e.g. -18.5)
    txPower: Number, // dBm
    rxPowerStatus: { type: String, enum: ["normal", "warning", "critical", "unknown"], default: "unknown" },
    // Thresholds
    rxWarningThreshold: { type: Number, default: -25 },
    rxCriticalThreshold: { type: Number, default: -28 },
    // Customer link
    linkedCustomerId: { type: String, index: true },
    linkedNetworkAssetId: String,
    // Location (from linked asset or manual)
    location: {
      lat: Number,
      lng: Number
    },
    // Metadata
    distance: Number, // meters from OLT
    uptime: String,
    lastPollAt: Date,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

ontStatusSchema.index({ oltCode: 1, ponPort: 1, ontIndex: 1 }, { unique: true });
ontStatusSchema.index({ onlineStatus: 1, rxPowerStatus: 1 });

export const OntStatus = mongoose.model("OntStatus", ontStatusSchema);
