import mongoose from "mongoose";

const collectionRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, index: true },
    franchiseCode: { type: String, index: true },
    amount: { type: Number, required: true },
    sourceType: { type: String, enum: ["admin", "customer", "franchise", "system"], default: "admin" },
    status: { type: String, enum: ["pending", "approved", "rejected", "paid"], default: "pending", index: true },
    assignedTo: String,
    note: String,
    approvedBy: mongoose.Schema.Types.ObjectId,
    rejectedBy: mongoose.Schema.Types.ObjectId,
    paidAt: Date,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const CollectionRequest = mongoose.model("CollectionRequest", collectionRequestSchema);
