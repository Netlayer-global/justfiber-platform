import mongoose from "mongoose";

const addonCatalogSchema = new mongoose.Schema(
  {
    addonCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true, index: true },
    price: { type: Number, default: 0 },
    description: String,
    imageUrl: String,
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

export const AddonCatalog = mongoose.model("AddonCatalog", addonCatalogSchema);
