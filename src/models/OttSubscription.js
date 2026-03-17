import mongoose from "mongoose";

const ottSubscriptionSchema = new mongoose.Schema(
  {
    subscriptionCode: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerUserId: { type: mongoose.Schema.Types.ObjectId, index: true },
    serviceId: { type: String, index: true },
    addonCode: { type: String, index: true },
    providerKey: { type: String, index: true },
    provider: { type: String, default: "mock" },
    planCode: String,
    status: {
      type: String,
      enum: ["draft", "queued", "active", "paused", "cancelled", "failed", "expired"],
      default: "draft",
      index: true
    },
    entitlementId: String,
    startsAt: Date,
    expiresAt: Date,
    price: Number,
    metadata: mongoose.Schema.Types.Mixed,
    providerResponse: mongoose.Schema.Types.Mixed,
    errorMessage: String,
    timeline: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

ottSubscriptionSchema.index({ customerId: 1, createdAt: -1 });

export const OttSubscription = mongoose.model("OttSubscription", ottSubscriptionSchema);
