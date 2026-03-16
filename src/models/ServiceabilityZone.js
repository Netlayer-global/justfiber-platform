import mongoose from "mongoose";

const serviceabilityZoneSchema = new mongoose.Schema(
  {
    zoneName: { type: String, required: true },
    city: String,
    area: String,
    status: { type: String, enum: ["active", "planned", "coming_soon"], default: "planned", index: true },
    polygonGeoJson: mongoose.Schema.Types.Mixed,
    serviceType: { type: String, default: "fiber" },
    priority: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const ServiceabilityZone = mongoose.model("ServiceabilityZone", serviceabilityZoneSchema);
