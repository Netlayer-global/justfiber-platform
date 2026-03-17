import mongoose from "mongoose";

const natLogEntrySchema = new mongoose.Schema(
  {
    loggedAt: { type: Date, required: true, index: true },
    eventType: { type: String, enum: ["open", "update", "close"], default: "open" },
    subscriberId: { type: String, index: true },
    customerId: { type: String, index: true },
    pppoeUsername: { type: String, index: true },
    sessionId: { type: String, index: true },
    nasIdentifier: String,
    routerIp: { type: String, index: true },
    privateIp: { type: String, index: true },
    privatePort: Number,
    publicIp: { type: String, index: true },
    publicPort: Number,
    destinationIp: { type: String, index: true },
    destinationPort: Number,
    translatedDestinationIp: String,
    translatedDestinationPort: Number,
    protocol: { type: Number, index: true },
    bytesUp: Number,
    bytesDown: Number,
    connectionState: String,
    raw: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

natLogEntrySchema.index({ publicIp: 1, publicPort: 1, loggedAt: -1 });
natLogEntrySchema.index({ privateIp: 1, privatePort: 1, loggedAt: -1 });
natLogEntrySchema.index({ pppoeUsername: 1, loggedAt: -1 });

export const NatLogEntry = mongoose.model("NatLogEntry", natLogEntrySchema);
