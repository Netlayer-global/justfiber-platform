import mongoose from "mongoose";

const integrationConnectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    category: {
      type: String,
      enum: ["sms", "email", "whatsapp", "kyc", "ott", "payment_gateway", "crm", "acs", "analytics"],
      required: true,
      index: true
    },
    provider: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive", "testing"], default: "inactive", index: true },
    mode: { type: String, enum: ["sandbox", "production"], default: "sandbox" },
    capabilities: { type: [String], default: [] },
    credentialsMasked: mongoose.Schema.Types.Mixed,
    config: mongoose.Schema.Types.Mixed,
    health: mongoose.Schema.Types.Mixed,
    lastCheckedAt: Date,
    notes: String
  },
  { timestamps: true }
);

integrationConnectionSchema.index({ category: 1, status: 1 });

export const IntegrationConnection = mongoose.model("IntegrationConnection", integrationConnectionSchema);
