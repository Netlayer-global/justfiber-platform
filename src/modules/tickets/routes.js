import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { createTicketSchema, assignTicketSchema, resolveTicketSchema, updateTicketSchema, closeTicketSchema } from "./schemas.js";
import { auditFromRequest } from "../../common/audit.js";
import { CustomerUser } from "../../models/CustomerUser.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

async function notifyTicketCustomer(ticket, { type, title, body, payload }) {
  if (!ticket?.customerId) return;
  const users = await CustomerUser.find({ linkedCustomerIds: ticket.customerId }).select({ _id: 1 }).lean();
  if (!users.length) return;
  await CustomerNotification.insertMany(
    users.map((user) => ({
      customerUserId: user._id,
      type,
      title,
      body,
      payload,
    }))
  );
}

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

ticketsRouter.get(
  "/:ticketId",
  requirePermission(permissions.ticketRead),
  asyncHandler(async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.ticketId).lean();
    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }
    return ok(res, ticket);
  })
);

ticketsRouter.patch(
  "/:ticketId",
  requirePermission(permissions.ticketWrite),
  asyncHandler(async (req, res) => {
    const payload = updateTicketSchema.parse(req.body || {});
    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }
    if (payload.status) {
      ticket.status = payload.status;
    }
    if (payload.priority) {
      ticket.priority = payload.priority;
    }
    if (payload.assignedTeam !== undefined) {
      ticket.assignedTeam = payload.assignedTeam;
    }
    if (payload.note) {
      ticket.timeline.push({
        type: "updated",
        actorType: "admin",
        actorId: req.admin._id,
        note: payload.note
      });
    }
    await ticket.save();
    await auditFromRequest(req, {
      action: "ticket.updated",
      entityType: "ticket",
      entityId: ticket._id.toString(),
      metadata: payload
    });
    if (payload.status) {
      await notifyTicketCustomer(ticket, {
        type: "ticket_updated",
        title: "Support ticket updated",
        body: `${ticket.subject} is now ${ticket.status}.`,
        payload: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber, status: ticket.status }
      });
    }
    return ok(res, ticket);
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
    await notifyTicketCustomer(ticket, {
      type: "ticket_assigned",
      title: "Support ticket assigned",
      body: `${ticket.subject} is now assigned to the support team.`,
      payload: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber, status: ticket.status }
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
    await notifyTicketCustomer(ticket, {
      type: "ticket_resolved",
      title: "Support ticket resolved",
      body: `${ticket.subject} has been marked resolved.`,
      payload: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber, status: ticket.status }
    });
    return ok(res, ticket);
  })
);

ticketsRouter.post(
  "/:ticketId/close",
  requirePermission(permissions.ticketResolve),
  asyncHandler(async (req, res) => {
    const payload = closeTicketSchema.parse(req.body || {});
    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }
    ticket.status = "closed";
    ticket.closedAt = new Date();
    ticket.timeline.push({
      type: "closed",
      actorType: "admin",
      actorId: req.admin._id,
      note: payload.closeNote || "Ticket closed from admin panel"
    });
    await ticket.save();
    await auditFromRequest(req, {
      action: "ticket.closed",
      entityType: "ticket",
      entityId: ticket._id.toString()
    });
    await notifyTicketCustomer(ticket, {
      type: "ticket_closed",
      title: "Support ticket closed",
      body: `${ticket.subject} has been closed.`,
      payload: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber, status: ticket.status }
    });
    return ok(res, ticket);
  })
);
