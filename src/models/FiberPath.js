import mongoose from "mongoose";

const fiberPathSchema = new mongoose.Schema(
  {
    pathId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    pathType: {
      type: String,
      enum: ["backbone", "feeder", "distribution", "drop"],
      default: "distribution",
      index: true
    },
    zoneCode: { type: String, index: true },
    fromAssetId: String,
    toAssetId: String,
    status: { type: String, default: "healthy", index: true },
    fiberColor: { type: String, default: "" },
    coreCount: { type: Number },
    points: {
      type: [
        {
          lat: Number,
          lng: Number
        }
      ],
      default: []
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

fiberPathSchema.index({ zoneCode: 1, pathType: 1 });

export const FiberPath = mongoose.model("FiberPath", fiberPathSchema);
