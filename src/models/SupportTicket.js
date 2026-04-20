import mongoose from "mongoose";

const timelineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    actorType: { type: String, required: true },
    actorId: mongoose.Schema.Types.Mixed,
    note: { type: String, required: true }
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    serviceId: { type: String, index: true },
    sourceRequestId: { type: mongoose.Schema.Types.ObjectId, index: true },
    source: { type: String, enum: ["customer_app", "admin", "system"], default: "admin" },
    category: { type: String, required: true },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium", index: true },
    status: { type: String, enum: ["open", "assigned", "in_progress", "resolved", "closed"], default: "open", index: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    attachments: { type: [String], default: [] },
    zoneCode: { type: String, index: true },
    zoneName: String,
    assignedToAdminId: { type: mongoose.Schema.Types.ObjectId, index: true },
    assignedTeam: String,
    assignedInstallerId: { type: mongoose.Schema.Types.ObjectId, ref: "Installer", index: true },
    installerJobId: { type: mongoose.Schema.Types.ObjectId, ref: "InstallerJob", index: true },
    installerAssignmentMode: { type: String, enum: ["manual", "zone_pool", ""], default: "" },
    resolutionSummary: String,
    timeline: { type: [timelineSchema], default: [] },
    sla: {
      firstResponseDueAt: Date,
      resolutionDueAt: Date,
      breached: { type: Boolean, default: false }
    },
    closedAt: Date
  },
  { timestamps: true }
);

supportTicketSchema.index({ customerId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
supportTicketSchema.index({ assignedToAdminId: 1, status: 1 });
supportTicketSchema.index({ zoneCode: 1, status: 1, createdAt: -1 });

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
