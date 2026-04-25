import mongoose from "mongoose";

const deviceOpticalSampleSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    serviceId: { type: String, index: true },
    serialNumber: { type: String, index: true },
    productClass: String,
    measuredAt: { type: Date, required: true, index: true },
    rxPower: Number,
    txPower: Number,
    healthStatus: String,
    source: { type: String, default: "genie_sync" },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

deviceOpticalSampleSchema.index({ deviceId: 1, measuredAt: -1 });
deviceOpticalSampleSchema.index({ customerId: 1, measuredAt: -1 });

export const DeviceOpticalSample = mongoose.model("DeviceOpticalSample", deviceOpticalSampleSchema);
