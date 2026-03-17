import mongoose from "mongoose";

const integrationEventLogSchema = new mongoose.Schema(
  {
    integrationKey: { type: String, index: true },
    category: { type: String, index: true },
    provider: String,
    eventType: { type: String, required: true, index: true },
    status: { type: String, enum: ["queued", "success", "failed", "ignored"], default: "queued", index: true },
    entityType: String,
    entityId: mongoose.Schema.Types.Mixed,
    payload: mongoose.Schema.Types.Mixed,
    response: mongoose.Schema.Types.Mixed,
    errorMessage: String
  },
  { timestamps: true }
);

export const IntegrationEventLog = mongoose.model("IntegrationEventLog", integrationEventLogSchema);
