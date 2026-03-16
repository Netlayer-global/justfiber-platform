import mongoose from "mongoose";

const installerNotificationSchema = new mongoose.Schema(
  {
    installerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    payload: mongoose.Schema.Types.Mixed,
    readAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const InstallerNotification = mongoose.model("InstallerNotification", installerNotificationSchema);
