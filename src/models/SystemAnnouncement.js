import mongoose from "mongoose";

const systemAnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    audience: { type: String, enum: ["all", "admin", "customer", "installer", "sales"], default: "all", index: true },
    channels: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
    publishAt: Date,
    expiresAt: Date
  },
  { timestamps: true }
);

export const SystemAnnouncement = mongoose.model("SystemAnnouncement", systemAnnouncementSchema);
