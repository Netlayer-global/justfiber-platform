import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    adminUserId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    deviceInfo: String,
    ip: String,
    userAgent: String,
    expiresAt: { type: Date, required: true },
    revokedAt: Date
  },
  { timestamps: true }
);

export const AdminSession = mongoose.model("AdminSession", adminSessionSchema);
