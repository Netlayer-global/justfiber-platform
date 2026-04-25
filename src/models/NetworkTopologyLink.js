import mongoose from "mongoose";

const networkTopologyLinkSchema = new mongoose.Schema(
  {
    linkId: { type: String, required: true, unique: true, index: true },
    zoneCode: { type: String, index: true },
    linkType: {
      type: String,
      enum: ["splitter_port", "coupler_port", "fiber_chain", "uplink"],
      default: "fiber_chain",
      index: true
    },
    status: {
      type: String,
      enum: ["planned", "active", "warning", "cut"],
      default: "planned",
      index: true
    },
    parentAssetId: { type: String, required: true, index: true },
    parentPortLabel: { type: String, index: true },
    childAssetId: { type: String, required: true, index: true },
    childPortLabel: { type: String, index: true },
    fiberPathId: { type: String, index: true },
    notes: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

networkTopologyLinkSchema.index({ zoneCode: 1, parentAssetId: 1 });
networkTopologyLinkSchema.index({ zoneCode: 1, childAssetId: 1 });

export const NetworkTopologyLink = mongoose.model("NetworkTopologyLink", networkTopologyLinkSchema);
