import mongoose from "mongoose";

const franchiseCommissionSchema = new mongoose.Schema(
  {
    franchiseCode: { type: String, required: true, index: true },
    invoiceId: { type: String, index: true },
    paymentId: { type: String, index: true },
    customerId: String,
    type: { type: String, enum: ["commission", "payout"], required: true, index: true },
    amount: { type: Number, required: true },
    commissionPercent: Number,
    totalInvoiceAmount: Number,
    notes: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdByAdminId: mongoose.Schema.Types.ObjectId,
    postedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

franchiseCommissionSchema.index({ franchiseCode: 1, postedAt: -1 });

export const FranchiseCommission = mongoose.model("FranchiseCommission", franchiseCommissionSchema);
