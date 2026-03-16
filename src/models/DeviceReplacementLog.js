import mongoose from "mongoose";

const deviceReplacementLogSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    oldDeviceId: String,
    oldSerialNumber: String,
    newDeviceId: String,
    newSerialNumber: String,
    replacedByInstallerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reason: String
  },
  { timestamps: true }
);

export const DeviceReplacementLog = mongoose.model("DeviceReplacementLog", deviceReplacementLogSchema);
