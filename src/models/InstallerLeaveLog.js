import mongoose from "mongoose";

const installerLeaveLogSchema = new mongoose.Schema(
  {
    installerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, enum: ["start", "end"], required: true },
    startedAt: Date,
    endedAt: Date,
    expectedEndAt: Date,
    reason: String
  },
  { timestamps: true }
);

export const InstallerLeaveLog = mongoose.model("InstallerLeaveLog", installerLeaveLogSchema);
