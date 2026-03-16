import mongoose from "mongoose";

const currentLeaveSchema = new mongoose.Schema(
  {
    isOnLeave: { type: Boolean, default: false },
    startedAt: Date,
    expectedEndAt: Date,
    reason: String
  },
  { _id: false }
);

const installerSchema = new mongoose.Schema(
  {
    installerCode: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, unique: true, sparse: true, index: true },
    passwordHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "disabled", "locked"],
      default: "active",
      index: true
    },
    availabilityStatus: {
      type: String,
      enum: ["available", "on_leave", "busy"],
      default: "available",
      index: true
    },
    roles: { type: [String], default: ["installer"] },
    assignedCity: String,
    assignedZones: { type: [String], default: [] },
    skills: { type: [String], default: ["installation", "fault-repair"] },
    currentLeave: { type: currentLeaveSchema, default: () => ({}) },
    lastLoginAt: Date,
    lastSeenAt: Date,
    createdByAdminId: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

export const Installer = mongoose.model("Installer", installerSchema);
