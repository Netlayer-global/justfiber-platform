import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorType: { type: String, default: "admin", index: true },
    actorId: { type: mongoose.Schema.Types.Mixed, index: true },
    actorName: String,
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    requestId: String,
    correlationId: String,
    ip: String,
    userAgent: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
    result: { type: String, default: "success", index: true },
    reason: String
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
