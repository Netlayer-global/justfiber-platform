import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { Installer } from "../../models/Installer.js";
import { InstallerJob } from "../../models/InstallerJob.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { Customer } from "../../models/Customer.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import {
  createTicketSchema,
  assignTicketSchema,
  assignInstallerTicketSchema,
  resolveTicketSchema,
  updateTicketSchema,
  closeTicketSchema
} from "./schemas.js";
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

function normalizeZone(value) {
  return String(value || "").trim().toUpperCase();
}

function resolveCustomerZone(customer, ticket) {
  const zoneCode = normalizeZone(
    ticket?.zoneCode ||
      customer?.billingZoneCode ||
      customer?.billingSnapshot?.billingZoneCode ||
      customer?.zoneCode ||
      customer?.zoneContext?.zoneCode
  );
  const zoneName =
    ticket?.zoneName ||
    customer?.billingZoneName ||
    customer?.billingSnapshot?.billingZoneName ||
    customer?.zoneName ||
    customer?.zoneContext?.zoneName ||
    zoneCode;
  return { zoneCode, zoneName };
}

function buildCustomerSnapshot(customer, ticket) {
  const address = customer?.rawAddress
    ? [
        customer.rawAddress.line1,
        customer.rawAddress.line2,
        customer.rawAddress.area,
        customer.rawAddress.city,
        customer.rawAddress.state,
        customer.rawAddress.pinCode
      ].filter(Boolean).join(", ")
    : customer?.address || customer?.installationAddress || "";

  return {
    fullName: customer?.fullName || customer?.name || customer?.customerName || ticket.customerId,
    phone: customer?.phone || customer?.mobile || customer?.contactNumber || "",
    address,
    planName: customer?.planName || customer?.plan?.name || customer?.billingSnapshot?.planName || "",
    zoneCode: ticket.zoneCode,
    zoneName: ticket.zoneName
  };
}

async function notifyInstallers(installers, job, ticket, title) {
  if (!installers.length) return;
  await InstallerNotification.insertMany(
    installers.map((installer) => ({
      installerId: installer._id,
      type: "complaint_assigned",
      title,
      body: `${ticket.customerId} | ${ticket.subject} | ${job.jobNumber}`,
      payload: {
        installerJobId: job._id,
        jobNumber: job.jobNumber,
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber
      }
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
  "/:ticketId/installer-assignment",
  requirePermission(permissions.ticketAssign),
  asyncHandler(async (req, res) => {
    const payload = assignInstallerTicketSchema.parse(req.body || {});
    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }
    if (["resolved", "closed"].includes(ticket.status)) {
      throw new ApiError(409, "Resolved or closed tickets cannot be assigned to installers");
    }

    const customer = await Customer.findOne({ customerId: ticket.customerId }).lean();
    const { zoneCode, zoneName } = resolveCustomerZone(customer, ticket);
    if (!zoneCode) {
      throw new ApiError(409, "Ticket customer does not have a zone. Set customer zone before field assignment.");
    }

    let targetInstaller = null;
    let installersToNotify = [];

    if (payload.mode === "manual") {
      if (!payload.installerId) {
        throw new ApiError(400, "installerId is required for manual assignment");
      }
      targetInstaller = await Installer.findById(payload.installerId);
      if (!targetInstaller || targetInstaller.status !== "active") {
        throw new ApiError(404, "Active installer not found");
      }
      if (targetInstaller.availabilityStatus === "on_leave") {
        throw new ApiError(409, "Installer is on leave");
      }
      installersToNotify = [targetInstaller];
    } else {
      const zoneInstallers = await Installer.find({
        status: "active",
        availabilityStatus: { $ne: "on_leave" }
      });
      installersToNotify = zoneInstallers.filter((installer) =>
        (installer.assignedZones || []).map(normalizeZone).includes(zoneCode)
      );
      if (!installersToNotify.length) {
        throw new ApiError(409, "No active installers found for this zone");
      }
    }

    ticket.zoneCode = zoneCode;
    ticket.zoneName = zoneName;

    if (ticket.installerJobId) {
      const existingJob = await InstallerJob.findById(ticket.installerJobId);
      if (existingJob && !["completed", "cancelled", "failed"].includes(existingJob.status)) {
        existingJob.status = "assigned";
        existingJob.installerId = targetInstaller?._id;
        existingJob.assignment = {
          ...(existingJob.assignment || {}),
          assignedAt: new Date(),
          assignedBy: req.admin._id,
          autoAssigned: payload.mode === "zone_pool",
          poolVisible: payload.mode === "zone_pool",
          claimedAt: undefined,
          claimedBy: undefined,
          zone: zoneCode
        };
        existingJob.timeline.push({
          event: payload.mode === "zone_pool" ? "job.zone_pool_reopened" : "job.reassigned",
          actorType: "admin",
          actorId: req.admin._id,
          note:
            payload.note ||
            (payload.mode === "zone_pool"
              ? `Complaint reopened to ${zoneCode} installer pool`
              : `Complaint reassigned to ${targetInstaller.fullName}`)
        });
        await existingJob.save();

        if (targetInstaller) {
          targetInstaller.availabilityStatus = "busy";
          await targetInstaller.save();
        }

        ticket.status = "assigned";
        ticket.assignedTeam = "field_ops";
        ticket.assignedInstallerId = targetInstaller?._id;
        ticket.installerAssignmentMode = payload.mode;
        ticket.timeline.push({
          type: payload.mode === "zone_pool" ? "installer_pool_reopened" : "installer_reassigned",
          actorType: "admin",
          actorId: req.admin._id,
          note:
            payload.note ||
            (payload.mode === "zone_pool"
              ? `Visible to ${installersToNotify.length} installers in ${zoneCode}`
              : `Reassigned to ${targetInstaller.fullName}`)
        });
        await ticket.save();

        await notifyInstallers(
          installersToNotify,
          existingJob,
          ticket,
          payload.mode === "zone_pool" ? "Complaint reopened to zone" : "Complaint reassigned"
        );
        await auditFromRequest(req, {
          action: "ticket.installer_reassigned",
          entityType: "ticket",
          entityId: ticket._id.toString(),
          metadata: { mode: payload.mode, zoneCode, installerId: targetInstaller?._id?.toString() }
        });
        return ok(res, { ticket, job: existingJob, reassigned: true });
      }
    }

    const job = await InstallerJob.create({
      jobNumber: `CMP-${Date.now()}`,
      type: "complaint",
      status: "assigned",
      customerId: ticket.customerId,
      serviceId: ticket.serviceId,
      ticketId: ticket._id.toString(),
      installerId: targetInstaller?._id,
      priority: ticket.priority === "critical" ? "urgent" : ticket.priority === "high" ? "high" : "medium",
      customerSnapshot: buildCustomerSnapshot(customer, ticket),
      complaint: {
        category: ticket.category,
        subject: ticket.subject,
        description: ticket.description,
        ticketNumber: ticket.ticketNumber
      },
      assignment: {
        assignedAt: new Date(),
        assignedBy: req.admin._id,
        autoAssigned: payload.mode === "zone_pool",
        poolVisible: payload.mode === "zone_pool",
        zone: zoneCode
      },
      timeline: [
        {
          event: payload.mode === "zone_pool" ? "job.zone_pool_assigned" : "job.assigned",
          actorType: "admin",
          actorId: req.admin._id,
          note:
            payload.note ||
            (payload.mode === "zone_pool"
              ? `Complaint opened to ${zoneCode} installer pool`
              : `Complaint assigned to ${targetInstaller.fullName}`)
        }
      ]
    });

    if (targetInstaller) {
      targetInstaller.availabilityStatus = "busy";
      await targetInstaller.save();
    }

    ticket.status = "assigned";
    ticket.assignedTeam = "field_ops";
    ticket.assignedInstallerId = targetInstaller?._id;
    ticket.installerJobId = job._id;
    ticket.installerAssignmentMode = payload.mode;
    ticket.timeline.push({
      type: payload.mode === "zone_pool" ? "installer_pool_assigned" : "installer_assigned",
      actorType: "admin",
      actorId: req.admin._id,
      note:
        payload.note ||
        (payload.mode === "zone_pool"
          ? `Visible to ${installersToNotify.length} installers in ${zoneCode}`
          : `Assigned to ${targetInstaller.fullName}`)
    });
    await ticket.save();

    await notifyInstallers(
      installersToNotify,
      job,
      ticket,
      payload.mode === "zone_pool" ? "New zone complaint" : "New complaint job"
    );
    await notifyTicketCustomer(ticket, {
      type: "ticket_assigned",
      title: "Complaint assigned",
      body:
        payload.mode === "zone_pool"
          ? "Your complaint has been opened to the field team."
          : "Your complaint has been assigned to a field engineer.",
      payload: { ticketId: ticket._id.toString(), ticketNumber: ticket.ticketNumber, installerJobId: job._id.toString() }
    });
    await auditFromRequest(req, {
      action: "ticket.installer_assigned",
      entityType: "ticket",
      entityId: ticket._id.toString(),
      metadata: { mode: payload.mode, zoneCode, installerId: targetInstaller?._id?.toString() }
    });

    return ok(res, { ticket, job, notifiedInstallers: installersToNotify.length }, { created: true });
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
