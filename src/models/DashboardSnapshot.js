import mongoose from "mongoose";

const dashboardSnapshotSchema = new mongoose.Schema(
  {
    snapshotType: { type: String, required: true, index: true },
    intervalStart: Date,
    intervalEnd: Date,
    metrics: mongoose.Schema.Types.Mixed,
    generatedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

dashboardSnapshotSchema.index({ snapshotType: 1, generatedAt: -1 });

export const DashboardSnapshot = mongoose.model("DashboardSnapshot", dashboardSnapshotSchema);
