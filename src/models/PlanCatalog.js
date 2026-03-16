import mongoose from "mongoose";

const planCatalogSchema = new mongoose.Schema(
  {
    planCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    speedMbps: Number,
    monthlyPrice: Number,
    otcCharge: Number,
    taxIncluded: Boolean,
    features: mongoose.Schema.Types.Mixed,
    tags: { type: [String], default: [] },
    staticBenefits: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const PlanCatalog = mongoose.model("PlanCatalog", planCatalogSchema);
