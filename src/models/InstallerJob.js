import mongoose from "mongoose";

const timelineSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    actorType: { type: String, required: true },
    actorId: mongoose.Schema.Types.Mixed,
    note: String,
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const installerJobSchema = new mongoose.Schema(
  {
    jobNumber: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["installation", "complaint"], required: true, index: true },
    status: {
      type: String,
      enum: [
        "assigned",
        "accepted",
        "enroute",
        "onsite",
        "ont_scanned",
        "activation_in_progress",
        "active",
        "complaint_in_progress",
        "completed",
        "failed",
        "cancelled"
      ],
      default: "assigned",
      index: true
    },
    subStatus: String,
    customerId: { type: String, required: true, index: true },
    serviceId: { type: String, index: true },
    ticketId: { type: String, index: true },
    installerId: { type: mongoose.Schema.Types.ObjectId, ref: "Installer", required: true, index: true },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },
    assignment: {
      assignedAt: Date,
      assignedBy: mongoose.Schema.Types.ObjectId,
      autoAssigned: Boolean,
      zone: String
    },
    customerSnapshot: mongoose.Schema.Types.Mixed,
    deviceContext: mongoose.Schema.Types.Mixed,
    opticalReadings: mongoose.Schema.Types.Mixed,
    activation: mongoose.Schema.Types.Mixed,
    proof: mongoose.Schema.Types.Mixed,
    complaint: mongoose.Schema.Types.Mixed,
    otp: mongoose.Schema.Types.Mixed,
    timeline: { type: [timelineSchema], default: [] },
    completedAt: Date
  },
  { timestamps: true }
);

installerJobSchema.index({ installerId: 1, status: 1, createdAt: -1 });
installerJobSchema.index({ type: 1, status: 1, createdAt: -1 });

export const InstallerJob = mongoose.model("InstallerJob", installerJobSchema);
