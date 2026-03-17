import mongoose from "mongoose";

const kycVerificationRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, index: true },
    customerUserId: { type: mongoose.Schema.Types.ObjectId, index: true },
    providerKey: { type: String, index: true },
    provider: { type: String, default: "mock" },
    documentType: {
      type: String,
      enum: ["aadhaar", "pan", "gst", "passport", "voter", "driving_license", "other"],
      default: "aadhaar",
      index: true
    },
    documentNumberMasked: String,
    status: {
      type: String,
      enum: ["draft", "queued", "submitted", "verified", "rejected", "failed"],
      default: "draft",
      index: true
    },
    verificationMode: {
      type: String,
      enum: ["otp", "ocr", "offline_xml", "manual_review", "other"],
      default: "otp"
    },
    payload: mongoose.Schema.Types.Mixed,
    providerResponse: mongoose.Schema.Types.Mixed,
    errorMessage: String,
    verifiedAt: Date,
    rejectedAt: Date,
    timeline: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

kycVerificationRequestSchema.index({ status: 1, createdAt: -1 });

export const KycVerificationRequest = mongoose.model("KycVerificationRequest", kycVerificationRequestSchema);
