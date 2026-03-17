import mongoose from "mongoose";

const inventoryLocationSchema = new mongoose.Schema(
  {
    locationCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    type: { type: String, enum: ["warehouse", "store", "installer", "franchise", "customer_site", "other"], default: "warehouse" },
    zoneCode: String,
    franchiseCode: String,
    address: String,
    contactName: String,
    phone: String,
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const InventoryLocation = mongoose.model("InventoryLocation", inventoryLocationSchema);
