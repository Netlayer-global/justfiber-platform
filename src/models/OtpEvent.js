import mongoose from "mongoose";

const otpEventSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    purpose: { type: String, enum: ["install_complete", "complaint_complete"], required: true, index: true },
    phone: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verifiedAt: Date,
    attempts: { type: Number, default: 0 },
    status: { type: String, enum: ["sent", "verified", "expired", "failed"], default: "sent" }
  },
  { timestamps: true }
);

export const OtpEvent = mongoose.model("OtpEvent", otpEventSchema);
