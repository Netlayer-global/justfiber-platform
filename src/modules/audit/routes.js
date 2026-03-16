import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { AuditLog } from "../../models/AuditLog.js";
import { buildPagination } from "../../common/pagination.js";

export const auditRouter = Router();

auditRouter.use(requireAuth, requirePermission(permissions.auditRead));

auditRouter.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.entityType) {
      filter.entityType = req.query.entityType;
    }
    if (req.query.entityId) {
      filter.entityId = req.query.entityId;
    }
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);
