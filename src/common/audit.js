import { AuditLog } from "../models/AuditLog.js";

export async function writeAuditLog({
  actorType = "admin",
  actorId,
  actorName,
  action,
  entityType,
  entityId,
  requestId,
  correlationId,
  ip,
  userAgent,
  before,
  after,
  metadata,
  result = "success",
  reason
}) {
  return AuditLog.create({
    actorType,
    actorId,
    actorName,
    action,
    entityType,
    entityId,
    requestId,
    correlationId,
    ip,
    userAgent,
    before,
    after,
    metadata,
    result,
    reason
  });
}

export function auditFromRequest(req, payload) {
  return writeAuditLog({
    requestId: req.requestId,
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    actorId: req.admin?._id,
    actorName: req.admin?.fullName,
    ...payload
  });
}
