import mongoose from "mongoose";

const ipPoolRangeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    zone: String,
    routerNodeCode: String,
    type: { type: String, enum: ["public", "private"], default: "public" },
    format: { type: String, enum: ["range", "cidr"], default: "range" },
    ipFrom: String,
    ipTo: String,
    networkCidr: String,
    excludedIps: { type: [String], default: [] },
    excludeZone: String,
    comments: String,
    useForRadius: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    lastRouterSyncs: {
      type: [
        {
          routerNodeCode: String,
          routerDisplayName: String,
          status: String,
          action: String,
          target: String,
          detail: String,
          syncedAt: Date
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

ipPoolRangeSchema.index({ name: 1, routerNodeCode: 1 }, { unique: true });
ipPoolRangeSchema.index({ zone: 1, type: 1 });

export const IpPoolRange = mongoose.model("IpPoolRange", ipPoolRangeSchema);
