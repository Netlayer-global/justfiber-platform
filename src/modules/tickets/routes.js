import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { createTicketSchema, assignTicketSchema, resolveTicketSchema } from "./schemas.js";
import { auditFromRequest } from "../../common/audit.js";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

ticketsRouter.get(
  "/",
  requirePermission(permissions.ticketRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const [items, total] = await Promise.all([
      SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicket.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

ticketsRouter.post(
  "/",
  requirePermission(permissions.ticketWrite),
  asyncHandler(async (req, res) => {
    const payload = createTicketSchema.parse(req.body);
    const ticket = await SupportTicket.create({
      ...payload,
      ticketNumber: `TKT-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
      timeline: [
        {
          type: "created",
          actorType: "admin",
          actorId: req.admin._id,
          note: payload.description
        }
      ]
    });
    await auditFromRequest(req, {
      action: "ticket.created",
      entityType: "ticket",
      entityId: ticket._id.toString()
    });
    return ok(res, ticket, { created: true });
  })
);

ticketsRouter.post(
  "/:ticketId/assign",
  requirePermission(permissions.ticketAssign),
  asyncHandler(async (req, res) => {
    const payload = assignTicketSchema.parse(req.body);
    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }
    ticket.assignedToAdminId = payload.assignedToAdminId;
    ticket.status = "assigned";
    ticket.timeline.push({
      type: "assigned",
      actorType: "admin",
      actorId: req.admin._id,
      note: `Assigned to ${payload.assignedToAdminId}`
    });
    await ticket.save();
    await auditFromRequest(req, {
      action: "ticket.assigned",
      entityType: "ticket",
      entityId: ticket._id.toString()
    });
    return ok(res, ticket);
  })
);

ticketsRouter.post(
  "/:ticketId/resolve",
  requirePermission(permissions.ticketResolve),
  asyncHandler(async (req, res) => {
    const payload = resolveTicketSchema.parse(req.body);
    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }
    ticket.status = "resolved";
    ticket.resolutionSummary = payload.resolutionSummary;
    ticket.timeline.push({
      type: "resolved",
      actorType: "admin",
      actorId: req.admin._id,
      note: payload.resolutionSummary
    });
    await ticket.save();
    await auditFromRequest(req, {
      action: "ticket.resolved",
      entityType: "ticket",
      entityId: ticket._id.toString()
    });
    return ok(res, ticket);
  })
);
