import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    accountNumber: { type: String, index: true },
    fullName: { type: String, required: true, index: true },
    phone: { type: String, index: true },
    email: String,
    serviceId: { type: String, required: true, index: true },
    planCode: String,
    planName: String,
    customerType: { type: String, enum: ["home", "business"], default: "home", index: true },
    billingZoneCode: String,
    billingZoneName: String,
    billingStateCode: String,
    billingStateName: String,
    jazeStatus: { type: String, default: "unknown", index: true },
    operationalStatus: { type: String, default: "unknown", index: true },
    expiryAt: Date,
    billingSnapshot: mongoose.Schema.Types.Mixed,
    invoiceSummary: mongoose.Schema.Types.Mixed,
    address: mongoose.Schema.Types.Mixed,
    lastSyncedAt: Date
  },
  { timestamps: true }
);

export const Customer = mongoose.model("Customer", customerSchema);
