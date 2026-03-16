import mongoose from "mongoose";

const networkNodeStatusSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true, unique: true, index: true },
    nodeType: { type: String, required: true, index: true },
    name: { type: String, required: true },
    area: String,
    vendor: String,
    managementIp: String,
    status: { type: String, default: "unknown", index: true },
    uptimeSeconds: Number,
    cpuUsagePercent: Number,
    memoryUsagePercent: Number,
    activeSessions: Number,
    sessionCapacity: Number,
    rxPowerAverage: Number,
    txPowerAverage: Number,
    alarms: { type: [String], default: [] },
    lastHeartbeatAt: Date,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

networkNodeStatusSchema.index({ nodeType: 1, status: 1 });
networkNodeStatusSchema.index({ area: 1, status: 1 });

export const NetworkNodeStatus = mongoose.model("NetworkNodeStatus", networkNodeStatusSchema);
