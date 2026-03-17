import mongoose from "mongoose";

const notificationChannelsSchema = new mongoose.Schema(
  {
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    push: { type: Boolean, default: false }
  },
  { _id: false }
);

const notificationEventPreferenceSchema = new mongoose.Schema(
  {
    eventKey: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true },
    category: { type: String, required: true, index: true },
    audience: { type: String, default: "customer", index: true },
    description: String,
    channels: { type: notificationChannelsSchema, default: () => ({}) },
    enabled: { type: Boolean, default: true },
    metadata: mongoose.Schema.Types.Mixed,
    updatedBy: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

export const NotificationEventPreference = mongoose.model(
  "NotificationEventPreference",
  notificationEventPreferenceSchema
);
