import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Role = mongoose.model("Role", roleSchema);
