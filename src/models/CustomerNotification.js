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

export const CustomerNotification = mongoose.model("CustomerNotification", customerNotificationSchema);
