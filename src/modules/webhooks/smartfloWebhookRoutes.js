import crypto from "crypto";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { env } from "../../config/env.js";
import { CallLog } from "../../models/CallLog.js";
import { Lead } from "../../models/Lead.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { Customer } from "../../models/Customer.js";

export const smartfloWebhookRouter = Router();

// --- Helpers ---

function verifySmartfloWebhook(req, res, next) {
  const secret = req.headers["x-smartflo-webhook-secret"] || req.query.secret;
  if (!env.SMARTFLO_WEBHOOK_SECRET || secret !== env.SMARTFLO_WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, error: "Invalid webhook secret" });
  }
  next();
}

function identifyCallType(calledNumber) {
  const normalized = String(calledNumber || "").replace(/\D/g, "");
  const salesNum = String(env.SMARTFLO_SALES_NUMBER || "").replace(/\D/g, "");
  const complaintNum = String(env.SMARTFLO_COMPLAINT_NUMBER || "").replace(/\D/g, "");

  if (salesNum && normalized.endsWith(salesNum.slice(-10))) return "sales";
  if (complaintNum && normalized.endsWith(complaintNum.slice(-10))) return "complaint";
  return "unknown";
}

function mapEventToStatus(event) {
  switch (event) {
    case "call.ringing": return "ringing";
    case "call.answered": return "answered";
    case "call.completed": return "answered";
    case "call.missed": return "missed";
    default: return "ringing";
  }
}

function buildLeadNumber() {
  return `LD${Math.floor(100000 + Math.random() * 900000)}`;
}

async function createUniqueLeadNumber() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const leadNumber = buildLeadNumber();
    const exists = await Lead.exists({ leadNumber });
    if (!exists) return leadNumber;
  }
  return `LD${Date.now().toString().slice(-6)}`;
}

function resolveIvrCategory(ivrInput) {
  switch (String(ivrInput || "").trim()) {
    case "1": return "internet";
    case "2": return "billing";
    default: return "general";
  }
}

function resolveIvrSubject(ivrInput) {
  switch (String(ivrInput || "").trim()) {
    case "1": return "Internet Issue (via Smartflo IVR)";
    case "2": return "Billing Issue (via Smartflo IVR)";
    default: return "General Complaint (via Smartflo IVR)";
  }
}

async function findCustomerByPhone(phone) {
  const normalized = String(phone || "").replace(/\D/g, "").slice(-10);
  if (!normalized) return null;

  const regex = new RegExp(normalized + "$");
  return Customer.findOne({
    $or: [
      { mobile: regex },
      { phone: regex },
      { alternateMobile: regex }
    ]
  }).lean();
}

// --- Sales call handler ---

async function handleSalesCall(payload, event) {
  const { call_id, caller_number, called_number, agent_number, agent_name, duration, status, recording_url, ivr_input } = payload;
  const callStatus = status || mapEventToStatus(event);

  // Create or update call log
  const callLog = await CallLog.findOneAndUpdate(
    { callId: call_id },
    {
      $set: {
        callerNumber: caller_number,
        calledNumber: called_number,
        direction: "inbound",
        callType: "sales",
        status: callStatus,
        duration: duration || 0,
        ivrInput: ivr_input || "",
        agentNumber: agent_number || "",
        agentName: agent_name || "",
        recordingUrl: recording_url || "",
        rawPayload: payload
      }
    },
    { upsert: true, new: true }
  );

  // Auto-create lead on completed/answered or missed calls
  if (event === "call.completed" || event === "call.missed" || event === "call.answered") {
    if (!callLog.leadId) {
      const leadNumber = await createUniqueLeadNumber();
      const lead = await Lead.create({
        leadNumber,
        type: "admin_created",
        status: "new",
        source: "smartflo_sales",
        leadCategory: "home",
        mobile: caller_number,
        fullName: `Sales Call — ${caller_number}`,
        notes: callStatus === "missed"
          ? `Missed sales call from ${caller_number} (Smartflo call ID: ${call_id})`
          : `Inbound sales call from ${caller_number} (Smartflo call ID: ${call_id})`,
        activityLog: [
          {
            type: "call_received",
            message: `Auto-created from Smartflo ${callStatus} call`,
            at: new Date(),
            meta: { callId: call_id, duration, agentName: agent_name || "" }
          }
        ]
      });

      await CallLog.updateOne({ _id: callLog._id }, { $set: { leadId: lead._id } });
    }
  }

  return callLog;
}

// --- Complaint call handler ---

async function handleComplaintCall(payload, event) {
  const { call_id, caller_number, called_number, agent_number, agent_name, duration, status, recording_url, ivr_input } = payload;
  const callStatus = status || mapEventToStatus(event);

  // Create or update call log
  const callLog = await CallLog.findOneAndUpdate(
    { callId: call_id },
    {
      $set: {
        callerNumber: caller_number,
        calledNumber: called_number,
        direction: "inbound",
        callType: "complaint",
        status: callStatus,
        duration: duration || 0,
        ivrInput: ivr_input || "",
        agentNumber: agent_number || "",
        agentName: agent_name || "",
        recordingUrl: recording_url || "",
        rawPayload: payload
      }
    },
    { upsert: true, new: true }
  );

  // Auto-create ticket on completed/answered calls
  if ((event === "call.completed" || event === "call.answered") && !callLog.ticketId) {
    const customer = await findCustomerByPhone(caller_number);

    if (customer) {
      // Known customer → create support ticket
      const ticketNumber = `TKT-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
      const category = resolveIvrCategory(ivr_input);
      const subject = resolveIvrSubject(ivr_input);

      const ticket = await SupportTicket.create({
        ticketNumber,
        customerId: customer.customerId,
        serviceId: customer.serviceId || "",
        source: "system",
        category,
        priority: "medium",
        status: "open",
        subject,
        description: `Auto-created from Smartflo complaint call.\nCaller: ${caller_number}\nIVR Input: ${ivr_input || "none"}\nAgent: ${agent_name || "N/A"}\nDuration: ${duration || 0}s\nCall ID: ${call_id}`,
        zoneCode: customer.zoneCode || "",
        zoneName: customer.zoneName || "",
        timeline: [
          {
            type: "created",
            actorType: "system",
            actorId: "smartflo",
            note: `Ticket auto-created from Smartflo IVR call (${category})`
          }
        ]
      });

      await CallLog.updateOne(
        { _id: callLog._id },
        { $set: { ticketId: ticket._id, customerId: customer.customerId, customerName: customer.fullName || "" } }
      );
    } else {
      // Unknown caller → create lead for follow-up
      if (!callLog.leadId) {
        const leadNumber = await createUniqueLeadNumber();
        const lead = await Lead.create({
          leadNumber,
          type: "admin_created",
          status: "new",
          source: "smartflo_unknown_caller",
          leadCategory: "home",
          mobile: caller_number,
          fullName: `Unknown Caller — ${caller_number}`,
          notes: `Unknown caller on complaint line. IVR input: ${ivr_input || "none"}. Call ID: ${call_id}`,
          activityLog: [
            {
              type: "call_received",
              message: "Auto-created from Smartflo complaint call (unknown caller)",
              at: new Date(),
              meta: { callId: call_id, duration, ivrInput: ivr_input || "" }
            }
          ]
        });

        await CallLog.updateOne({ _id: callLog._id }, { $set: { leadId: lead._id } });
      }
    }
  }

  // Missed complaint call → also create lead if no customer found
  if (event === "call.missed" && !callLog.ticketId && !callLog.leadId) {
    const customer = await findCustomerByPhone(caller_number);
    if (!customer) {
      const leadNumber = await createUniqueLeadNumber();
      const lead = await Lead.create({
        leadNumber,
        type: "admin_created",
        status: "new",
        source: "smartflo_unknown_caller",
        leadCategory: "home",
        mobile: caller_number,
        fullName: `Missed Call — ${caller_number}`,
        notes: `Missed call on complaint line from unknown number. Call ID: ${call_id}`,
        activityLog: [
          {
            type: "call_missed",
            message: "Missed call on complaint line (unknown caller)",
            at: new Date(),
            meta: { callId: call_id }
          }
        ]
      });
      await CallLog.updateOne({ _id: callLog._id }, { $set: { leadId: lead._id } });
    }
  }

  return callLog;
}

// --- Main webhook endpoint ---

// POST /api/v1/webhooks/smartflo
smartfloWebhookRouter.post(
  "/smartflo",
  verifySmartfloWebhook,
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const event = payload.event;

    if (!event) {
      return res.status(400).json({ success: false, error: "Missing event field" });
    }

    const calledNumber = payload.called_number || "";
    const callType = identifyCallType(calledNumber);

    let callLog;
    switch (callType) {
      case "sales":
        callLog = await handleSalesCall(payload, event);
        break;
      case "complaint":
        callLog = await handleComplaintCall(payload, event);
        break;
      default: {
        // Unknown number — log it anyway
        callLog = await CallLog.findOneAndUpdate(
          { callId: payload.call_id },
          {
            $set: {
              callerNumber: payload.caller_number || "",
              calledNumber: calledNumber,
              direction: "inbound",
              callType: "unknown",
              status: mapEventToStatus(event),
              duration: payload.duration || 0,
              ivrInput: payload.ivr_input || "",
              agentNumber: payload.agent_number || "",
              agentName: payload.agent_name || "",
              recordingUrl: payload.recording_url || "",
              rawPayload: payload
            }
          },
          { upsert: true, new: true }
        );
        break;
      }
    }

    return ok(res, { received: true, event, callType, callLogId: callLog?._id });
  })
);
