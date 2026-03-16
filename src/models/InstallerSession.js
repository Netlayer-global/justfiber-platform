import mongoose from "mongoose";

const installerSessionSchema = new mongoose.Schema(
  {
    installerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    deviceId: String,
    appVersion: String,
    ip: String,
    expiresAt: { type: Date, required: true },
    revokedAt: Date
  },
  { timestamps: true }
);

export const InstallerSession = mongoose.model("InstallerSession", installerSessionSchema);
