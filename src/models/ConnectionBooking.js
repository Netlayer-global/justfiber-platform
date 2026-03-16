import mongoose from "mongoose";

const connectionBookingSchema = new mongoose.Schema(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },
    customerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerUser", index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", index: true },
    status: { type: String, enum: ["initiated", "feasible", "payment_pending", "paid", "awaiting_assignment", "assigned", "in_progress", "installed", "cancelled"], default: "initiated", index: true },
    source: { type: String, default: "customer_app" },
    selectedPlan: mongoose.Schema.Types.Mixed,
    feasibility: mongoose.Schema.Types.Mixed,
    personalDetails: mongoose.Schema.Types.Mixed,
    payment: mongoose.Schema.Types.Mixed,
    assignment: mongoose.Schema.Types.Mixed,
    tracking: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const ConnectionBooking = mongoose.model("ConnectionBooking", connectionBookingSchema);
