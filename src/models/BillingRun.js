import mongoose from "mongoose";

const billingRunSchema = new mongoose.Schema(
  {
    runId: { type: String, required: true, unique: true, index: true },
    triggerMode: { type: String, enum: ["manual", "scheduled", "retry"], default: "manual", index: true },
    billCycle: { type: String, index: true },
    status: { type: String, enum: ["queued", "running", "completed", "failed"], default: "queued", index: true },
    scope: {
      customerId: { type: String, index: true },
      serviceId: { type: String, index: true }
    },
    totals: {
      processed: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      billedAmount: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 }
    },
    filters: mongoose.Schema.Types.Mixed,
    results: { type: [mongoose.Schema.Types.Mixed], default: [] },
    notes: String,
    startedAt: Date,
    completedAt: Date,
    createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" }
  },
  { timestamps: true }
);

billingRunSchema.index({ status: 1, createdAt: -1 });

export const BillingRun = mongoose.model("BillingRun", billingRunSchema);
