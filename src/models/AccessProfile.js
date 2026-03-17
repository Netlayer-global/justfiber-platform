import mongoose from "mongoose";

const accessProfileSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    downMbps: { type: Number, required: true },
    upMbps: { type: Number, required: true },
    burstDownMbps: Number,
    burstUpMbps: Number,
    radiusAttributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    mikrotikProfileName: String,
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

accessProfileSchema.index({ active: 1, code: 1 });

export const AccessProfile = mongoose.model("AccessProfile", accessProfileSchema);
