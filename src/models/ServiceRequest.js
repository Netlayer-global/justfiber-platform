import mongoose from "mongoose";

const serviceRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    customerUserId: { type: mongoose.Schema.Types.ObjectId, index: true },
    customerId: { type: String, index: true },
    serviceId: { type: String, index: true },
    type: { type: String, required: true, index: true },
    status: { type: String, default: "open", index: true },
    payload: mongoose.Schema.Types.Mixed,
    timeline: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

serviceRequestSchema.index({ customerUserId: 1, createdAt: -1 });

export const ServiceRequest = mongoose.model("ServiceRequest", serviceRequestSchema);
