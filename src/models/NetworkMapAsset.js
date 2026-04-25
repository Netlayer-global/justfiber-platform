import mongoose from "mongoose";

const networkMapAssetSchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, unique: true, index: true },
    assetType: {
      type: String,
      enum: ["olt", "splitter", "coupler", "onu", "ont", "router", "joint", "odf"],
      required: true,
      index: true
    },
    label: { type: String, required: true },
    serialNumber: String,
    linkedCustomerId: { type: String, index: true },
    linkedDeviceId: { type: String, index: true },
    linkedServiceId: { type: String, index: true },
    zoneCode: { type: String, index: true },
    status: { type: String, default: "planned", index: true },
    portCapacity: Number,
    location: {
      lat: Number,
      lng: Number
    },
    rxPower: Number,
    txPower: Number,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

networkMapAssetSchema.index({ zoneCode: 1, assetType: 1 });

export const NetworkMapAsset = mongoose.model("NetworkMapAsset", networkMapAssetSchema);
