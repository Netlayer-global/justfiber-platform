import mongoose from "mongoose";

const appBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    imageUrl: String,
    targetType: String,
    targetValue: String,
    audience: { type: String, default: "all", index: true },
    active: { type: Boolean, default: true },
    startAt: Date,
    endAt: Date,
    sortOrder: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const AppBanner = mongoose.model("AppBanner", appBannerSchema);
