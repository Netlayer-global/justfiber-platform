import mongoose from "mongoose";

const planCatalogSchema = new mongoose.Schema(
  {
    planCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, default: "home" },
    speedMbps: Number,
    uploadSpeedMbps: Number,
    burstDownloadMbps: Number,
    burstUploadMbps: Number,
    dataLimitGb: Number,
    fupSpeedMbps: Number,
    dataPolicy: { type: String, default: "unlimited" },
    fairUsageResetPolicy: { type: String, default: "monthly" },
    latencyClass: { type: String, default: "standard" },
    contentionRatio: String,
    monthlyPrice: Number,
    quarterlyPrice: Number,
    halfYearlyPrice: Number,
    yearlyPrice: Number,
    otcCharge: Number,
    installationCharge: Number,
    taxIncluded: Boolean,
    gstRate: Number,
    pricesExcludeGst: { type: Boolean, default: false },
    billingBreakup: {
      internetLabel: String,
      platformLabel: String,
      monthlyPlatformFee: Number,
      quarterlyPlatformFee: Number,
      halfYearlyPlatformFee: Number,
      yearlyPlatformFee: Number
    },
    features: mongoose.Schema.Types.Mixed,
    tags: { type: [String], default: [] },
    staticBenefits: { type: [String], default: [] },
    ottApps: { type: [String], default: [] },
    routerIncluded: { type: Boolean, default: false },
    routerModel: String,
    routerRental: Number,
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
      wifiNamePrefix: String,
      jazeGroupId: String
    },
    merchandising: {
      featured: { type: Boolean, default: false },
      recommended: { type: Boolean, default: false },
      spotlightLabel: String
    },
    visibleInCustomerApp: { type: Boolean, default: true },
    visibleInSalesApp: { type: Boolean, default: true },
    visibleInProvisioning: { type: Boolean, default: true },
    planScope: { type: String, enum: ["global", "zone"], default: "global" },
    zoneContext: {
      zoneCode: String,
      zoneName: String,
      stateCode: String
    },
    active: { type: Boolean, default: true },
    archivedAt: Date,
    sortOrder: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const PlanCatalog = mongoose.model("PlanCatalog", planCatalogSchema);
