import mongoose from "mongoose";

const customerUserSchema = new mongoose.Schema(
  {
    mobile: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, unique: true, sparse: true, index: true },
    fullName: String,
    authMode: { type: String, enum: ["mobile_otp", "email_otp"], default: "mobile_otp" },
    linkedCustomerIds: { type: [String], default: [] },
    state: { type: String, enum: ["new_lead", "booking_in_progress", "active_customer", "suspended_customer"], default: "new_lead" },
    fcmToken: { type: String, default: null }
  },
  { timestamps: true }
);

export const CustomerUser = mongoose.model("CustomerUser", customerUserSchema);
