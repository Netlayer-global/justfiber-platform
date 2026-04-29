import mongoose from "mongoose";

const leadKycDocumentSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, index: true },
    connectionBookingId: { type: mongoose.Schema.Types.ObjectId, index: true },
    mobile: { type: String, index: true },
    documentType: { type: String, required: true },
    documentNumber: String,
    frontImageUrl: String,
    backImageUrl: String,
    selfieImageUrl: String,
    verificationStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    verifiedBy: mongoose.Schema.Types.ObjectId,
    rejectionReason: String
  },
  { timestamps: true }
);

export const LeadKycDocument = mongoose.model("LeadKycDocument", leadKycDocumentSchema);
