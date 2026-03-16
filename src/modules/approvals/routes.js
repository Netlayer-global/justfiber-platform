import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { AdminActionRequest } from "../../models/AdminActionRequest.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { decisionSchema } from "./schemas.js";
import { adminActionsQueue } from "../../queues/adminActionsQueue.js";
import { auditFromRequest } from "../../common/audit.js";

export const approvalsRouter = Router();

approvalsRouter.use(requireAuth);

approvalsRouter.get(
  "/requests",
  requirePermission(permissions.approvalRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const [items, total] = await Promise.all([
      AdminActionRequest.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdminActionRequest.countDocuments()
    ]);
    return ok(res, items, { page, limit, total });
  })
);

approvalsRouter.post(
  "/requests/:id/approve",
  requirePermission(permissions.approvalDecide),
  asyncHandler(async (req, res) => {
    const payload = decisionSchema.parse(req.body);
    const request = await AdminActionRequest.findById(req.params.id);
    if (!request) {
      throw new ApiError(404, "Action request not found");
    }
    request.status = "approved";
    request.approvers.push({
      adminUserId: req.admin._id,
      decision: "approved",
      note: payload.note
    });
    await request.save();
    await adminActionsQueue.add(
      "approved-action",
      { actionRequestId: request._id.toString() },
      { attempts: 5, backoff: { type: "exponential", delay: 2000 }, jobId: `action:${request._id.toString()}` }
    );
    await auditFromRequest(req, {
      action: "approval.approved",
      entityType: "admin_action_request",
      entityId: request._id.toString()
    });
    return ok(res, request);
  })
);

approvalsRouter.post(
  "/requests/:id/reject",
  requirePermission(permissions.approvalDecide),
  asyncHandler(async (req, res) => {
    const payload = decisionSchema.parse(req.body);
    const request = await AdminActionRequest.findById(req.params.id);
    if (!request) {
      throw new ApiError(404, "Action request not found");
    }
    request.status = "rejected";
    request.approvers.push({
      adminUserId: req.admin._id,
      decision: "rejected",
      note: payload.note
    });
    await request.save();
    await auditFromRequest(req, {
      action: "approval.rejected",
      entityType: "admin_action_request",
      entityId: request._id.toString(),
      reason: payload.note
    });
    return ok(res, request);
  })
);
