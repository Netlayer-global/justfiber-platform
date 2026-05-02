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

// Fire FCM push every time a notification is created — fire-and-forget so it
// never blocks the save or throws up the call stack.
installerNotificationSchema.post("save", function (doc) {
  import("../integrations/fcmPush.js")
    .then(({ sendInstallerPush }) =>
      sendInstallerPush(doc.installerId, doc.title, doc.body)
    )
    .catch(() => null);
});

export const InstallerNotification = mongoose.model("InstallerNotification", installerNotificationSchema);
