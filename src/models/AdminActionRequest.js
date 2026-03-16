import mongoose from "mongoose";

const approverSchema = new mongoose.Schema(
  {
    adminUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
    decision: { type: String, enum: ["approved", "rejected"], required: true },
    note: String,
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const adminActionRequestSchema = new mongoose.Schema(
  {
    actionType: { type: String, required: true, index: true },
    targetType: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    payload: mongoose.Schema.Types.Mixed,
    requestedBy: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    approvalPolicyId: String,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "executed", "failed", "expired"],
      default: "pending",
      index: true
    },
    approvers: { type: [approverSchema], default: [] },
    executionJobId: String,
    expiresAt: Date,
    lastError: String
  },
  { timestamps: true }
);

adminActionRequestSchema.index({ targetType: 1, targetId: 1, status: 1 });
adminActionRequestSchema.index({ requestedBy: 1, createdAt: -1 });

export const AdminActionRequest = mongoose.model("AdminActionRequest", adminActionRequestSchema);
