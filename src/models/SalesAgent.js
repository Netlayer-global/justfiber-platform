import mongoose from "mongoose";

const salesAgentSchema = new mongoose.Schema(
  {
    agentCode: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, unique: true, sparse: true, index: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    assignedAreas: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const SalesAgent = mongoose.model("SalesAgent", salesAgentSchema);
