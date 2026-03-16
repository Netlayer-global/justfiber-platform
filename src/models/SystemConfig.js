import mongoose from "mongoose";

const configHistorySchema = new mongoose.Schema(
  {
    version: Number,
    value: mongoose.Schema.Types.Mixed,
    updatedBy: mongoose.Schema.Types.ObjectId,
    updatedAt: Date
  },
  { _id: false }
);

const systemConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: mongoose.Schema.Types.Mixed,
    valueType: { type: String, required: true },
    category: { type: String, required: true, index: true },
    environment: { type: String, default: "production" },
    isSensitive: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    history: { type: [configHistorySchema], default: [] },
    updatedBy: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

export const SystemConfig = mongoose.model("SystemConfig", systemConfigSchema);
