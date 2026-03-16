import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    leadNumber: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["self_booked", "sales_created", "admin_created"], default: "self_booked" },
    status: { type: String, enum: ["new", "contacted", "interested", "kyc_pending", "feasible", "payment_pending", "converted", "dropped"], default: "new", index: true },
    source: { type: String, default: "app", index: true },
    salesAgentId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesAgent", index: true },
    customerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerUser", index: true },
    fullName: String,
    mobile: { type: String, index: true },
    alternateMobile: String,
    email: String,
    address: String,
    pinCode: String,
    gps: mongoose.Schema.Types.Mixed,
    zoneId: String,
    feasible: Boolean,
    selectedPlan: mongoose.Schema.Types.Mixed,
    kycStatus: { type: String, enum: ["pending", "submitted", "verified", "rejected"], default: "pending" },
    notes: String,
    followUpAt: Date,
    dropReason: String,
    convertedBookingId: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

export const Lead = mongoose.model("Lead", leadSchema);
