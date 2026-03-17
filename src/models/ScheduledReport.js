import mongoose from "mongoose";

const scheduledReportSchema = new mongoose.Schema(
  {
    reportCode: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    category: { type: String, required: true, index: true },
    frequency: { type: String, enum: ["daily", "weekly", "monthly", "manual"], default: "manual" },
    format: { type: String, enum: ["csv", "xlsx", "pdf", "json"], default: "csv" },
    recipients: { type: [String], default: [] },
    filters: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ["active", "paused"], default: "active", index: true },
    lastRunAt: Date,
    nextRunAt: Date
  },
  { timestamps: true }
);

export const ScheduledReport = mongoose.model("ScheduledReport", scheduledReportSchema);
