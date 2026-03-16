import mongoose from "mongoose";

const deviceOperationalCacheSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, index: true },
    serviceId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, unique: true, index: true },
    serialNumber: { type: String, index: true },
    oui: String,
    productClass: String,
    lastInformAt: Date,
    onlineStatus: { type: String, default: "unknown", index: true },
    provisioningState: { type: String, default: "unknown", index: true },
    wifiInfo: mongoose.Schema.Types.Mixed,
    wanInfo: mongoose.Schema.Types.Mixed,
    lanInfo: mongoose.Schema.Types.Mixed,
    opticalInfo: mongoose.Schema.Types.Mixed,
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
);

deviceOperationalCacheSchema.index({ onlineStatus: 1, updatedAt: -1 });
deviceOperationalCacheSchema.index({ provisioningState: 1, updatedAt: -1 });

export const DeviceOperationalCache = mongoose.model("DeviceOperationalCache", deviceOperationalCacheSchema);
