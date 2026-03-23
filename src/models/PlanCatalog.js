import mongoose from "mongoose";

const planCatalogSchema = new mongoose.Schema(
  {
    planCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, default: "home" },
    speedMbps: Number,
    monthlyPrice: Number,
    quarterlyPrice: Number,
    halfYearlyPrice: Number,
    yearlyPrice: Number,
    otcCharge: Number,
    installationCharge: Number,
    taxIncluded: Boolean,
    gstRate: Number,
    pricesExcludeGst: { type: Boolean, default: false },
    features: mongoose.Schema.Types.Mixed,
    tags: { type: [String], default: [] },
    staticBenefits: { type: [String], default: [] },
    validityOptions: {
      monthly: { type: Boolean, default: true },
      quarterly: { type: Boolean, default: false },
      halfYearly: { type: Boolean, default: false },
      yearly: { type: Boolean, default: false }
    },
    addons: {
      staticIp: {
        enabled: { type: Boolean, default: false },
        includedCount: { type: Number, default: 0 },
        extraPrice: Number
      },
      ott: {
        enabled: { type: Boolean, default: false },
        packageName: String,
        extraPrice: Number
      },
      voice: {
        enabled: { type: Boolean, default: false },
        packageName: String,
        channels: Number,
        extraPrice: Number
      }
    },
    provisioning: {
      accessProfileCode: String,
      vlanId: Number,
      pppoePrefix: String,
      pppoeRealm: String,
      defaultPppoePassword: String,
      wifiNamePrefix: String
    },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const PlanCatalog = mongoose.model("PlanCatalog", planCatalogSchema);
