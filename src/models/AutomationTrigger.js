import mongoose from "mongoose";

const automationTriggerSchema = new mongoose.Schema(
  {
    triggerCode: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    category: { type: String, required: true, index: true },
    eventKey: { type: String, required: true, index: true },
    actionType: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    conditions: mongoose.Schema.Types.Mixed,
    actionConfig: mongoose.Schema.Types.Mixed,
    lastTriggeredAt: Date
  },
  { timestamps: true }
);

export const AutomationTrigger = mongoose.model("AutomationTrigger", automationTriggerSchema);
