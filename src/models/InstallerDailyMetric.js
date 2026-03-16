import mongoose from "mongoose";

const installerDailyMetricSchema = new mongoose.Schema(
  {
    installerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    date: { type: String, required: true, index: true },
    newInstallations: { type: Number, default: 0 },
    completedInstallations: { type: Number, default: 0 },
    pendingInstallations: { type: Number, default: 0 },
    complaintsHandled: { type: Number, default: 0 },
    pendingComplaints: { type: Number, default: 0 },
    failedActivations: { type: Number, default: 0 },
    avgCompletionMinutes: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const InstallerDailyMetric = mongoose.model("InstallerDailyMetric", installerDailyMetricSchema);
