import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: String,
    passwordHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "disabled", "locked"],
      default: "active",
      index: true
    },
    roles: { type: [String], default: [] },
    permissionOverrides: {
      allow: { type: [String], default: [] },
      deny: { type: [String], default: [] }
    },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecretRef: String,
    lastLoginAt: Date,
    lastLoginIp: String,
    passwordChangedAt: Date,
    createdBy: mongoose.Schema.Types.ObjectId
  },
  { timestamps: true }
);

export const AdminUser = mongoose.model("AdminUser", adminUserSchema);
