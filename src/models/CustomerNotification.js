import mongoose from "mongoose";

const customerNotificationSchema = new mongoose.Schema(
  {
    customerUserId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    payload: mongoose.Schema.Types.Mixed,
    readAt: Date
  },
  { timestamps: true }
);

customerNotificationSchema.index({ customerUserId: 1, createdAt: -1 });

// Fire FCM push every time a notification is created — fire-and-forget so it
// never blocks the save or throws up the call stack.
customerNotificationSchema.post("save", function (doc) {
  import("../integrations/fcmPush.js")
    .then(({ sendCustomerPush }) =>
      sendCustomerPush(doc.customerUserId, doc.title, doc.body)
    )
    .catch(() => null);
});

export const CustomerNotification = mongoose.model("CustomerNotification", customerNotificationSchema);
