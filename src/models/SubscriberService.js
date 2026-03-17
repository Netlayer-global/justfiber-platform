import mongoose from "mongoose";

const subscriberServiceSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    accountNumber: { type: String, index: true },
    radiusUsername: { type: String, required: true, unique: true, index: true },
    radiusPasswordMasked: String,
    authType: { type: String, enum: ["pppoe", "hotspot", "ipoe"], default: "pppoe" },
    accessProfileCode: { type: String, index: true },
    billingProfileCode: { type: String, index: true },
    bngNodeCode: { type: String, index: true },
    ipv4Pool: String,
    currentIpv4: String,
    macAddress: String,
    ontSerialNumber: String,
    status: {
      type: String,
      enum: ["draft", "active", "suspended", "expired", "terminated", "pending_installation"],
      default: "draft",
      index: true
    },
    activatedAt: Date,
    suspendedAt: Date,
    expiresAt: Date,
    notes: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

subscriberServiceSchema.index({ customerId: 1, status: 1 });
subscriberServiceSchema.index({ bngNodeCode: 1, status: 1 });

export const SubscriberService = mongoose.model("SubscriberService", subscriberServiceSchema);
