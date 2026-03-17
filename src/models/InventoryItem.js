import mongoose from "mongoose";

const inventoryMovementSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    fromLocationCode: String,
    toLocationCode: String,
    note: String,
    actorId: mongoose.Schema.Types.Mixed
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const inventoryItemSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, unique: true, index: true },
    sku: { type: String, index: true },
    name: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ["ont", "router", "stb", "voice_device", "cable", "splitter", "accessory", "other"],
      default: "other",
      index: true
    },
    vendorCode: String,
    serialNumber: { type: String, index: true },
    macAddress: String,
    locationCode: { type: String, index: true },
    status: {
      type: String,
      enum: ["in_stock", "reserved", "assigned", "installed", "faulty", "returned", "disposed"],
      default: "in_stock",
      index: true
    },
    assignedToInstallerId: mongoose.Schema.Types.ObjectId,
    assignedCustomerId: String,
    metadata: mongoose.Schema.Types.Mixed,
    movements: { type: [inventoryMovementSchema], default: [] }
  },
  { timestamps: true }
);

export const InventoryItem = mongoose.model("InventoryItem", inventoryItemSchema);
