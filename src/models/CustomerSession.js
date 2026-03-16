import mongoose from "mongoose";

const customerSessionSchema = new mongoose.Schema(
  {
    customerUserId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date
  },
  { timestamps: true }
);

export const CustomerSession = mongoose.model("CustomerSession", customerSessionSchema);
