import mongoose from "mongoose";

const serviceabilityZoneSchema = new mongoose.Schema(
  {
    zoneCode: { type: String, unique: true, sparse: true, index: true },
    zoneName: { type: String, required: true },
    parentZoneCode: { type: String, index: true },
    parentZoneName: String,
    city: String,
    area: String,
    pinCodes: { type: [String], default: [] },
    // State the zone bills under (for multi-GSTIN resolution). 2-letter internal code.
    stateCode: { type: String, uppercase: true, trim: true },
    stateName: { type: String, trim: true },
    status: { type: String, enum: ["active", "planned", "coming_soon"], default: "planned", index: true },
    polygonGeoJson: mongoose.Schema.Types.Mixed,
    serviceType: { type: String, default: "fiber" },
    priority: { type: Number, default: 1 },
    center: {
      lat: Number,
      lng: Number
    },
    notes: String
  },
  { timestamps: true }
);

export const ServiceabilityZone = mongoose.model("ServiceabilityZone", serviceabilityZoneSchema);
