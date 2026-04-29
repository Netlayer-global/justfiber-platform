import { Router } from "express";
import PDFDocument from "pdfkit";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { AppBanner } from "../../models/AppBanner.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { Lead } from "../../models/Lead.js";
import { razorpayClient } from "../../integrations/razorpayClient.js";
import { LeadKycDocument } from "../../models/LeadKycDocument.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { SalesAgent } from "../../models/SalesAgent.js";
import { SystemConfig } from "../../models/SystemConfig.js";

export const adminSalesRouter = Router();

adminSalesRouter.use(requireAuth);

function normalizePhone(value = "") {
  return String(value || "").replace(/\D+/g, "");
}

function mergeLeadPlanDetails(lead = {}, booking = null, planCatalog = null) {
  const bookingPlan = booking?.selectedPlan || {};
  const leadPlan = lead?.selectedPlan || {};
  const preferredSlot =
    leadPlan?.preferredSlot
    || (lead?.requestedPreferredSlotCode
      ? {
          code: lead.requestedPreferredSlotCode,
          label: lead.requestedPreferredSlotLabel || lead.requestedPreferredSlotCode
        }
      : null)
    || bookingPlan?.preferredSlot
    || booking?.personalDetails?.preferredSlot
    || null;
  const planAmount =
    leadPlan?.amount
    || lead?.requestedPlanAmount
    || bookingPlan?.totalAmount
    || bookingPlan?.amount
    || booking?.payment?.amount
    || planCatalog?.monthlyPrice
    || planCatalog?.price
    || undefined;
  const durationMonths =
    leadPlan?.durationMonths
    || lead?.requestedDurationMonths
    || bookingPlan?.durationMonths
    || undefined;
  const durationLabel = String(
    leadPlan?.durationLabel
    || lead?.requestedDurationLabel
    || bookingPlan?.durationLabel
    || (durationMonths ? `${durationMonths} month${Number(durationMonths) > 1 ? "s" : ""}` : "")
  ).trim();
  return {
    ...lead,
    selectedPlan: {
      planCode: leadPlan?.planCode || lead?.requestedPlanCode || bookingPlan?.planCode || planCatalog?.planCode || undefined,
      planName: leadPlan?.planName || lead?.requestedPlanName || bookingPlan?.planName || planCatalog?.name || undefined,
      amount: planAmount,
      durationMonths,
      durationLabel: durationLabel || undefined,
      preferredSlot: preferredSlot
        ? {
            code: preferredSlot?.code || undefined,
            label: preferredSlot?.label || preferredSlot?.code || undefined
          }
        : undefined
    }
  };
}

function appendLeadActivity(lead, type, message, meta = {}) {
  const current = Array.isArray(lead.activityLog) ? lead.activityLog : [];
  lead.activityLog = [
    {
      type,
      message,
      at: new Date(),
      meta
    },
    ...current
  ].slice(0, 25);
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
  throw new ApiError(500, "Failed to generate lead number");
}

adminSalesRouter.get(
  "/sales/overview",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (_req, res) => {
    const [leadCount, bookingCount, kycPending, salesAgents] = await Promise.all([
      Lead.countDocuments(),
      ConnectionBooking.countDocuments(),
      LeadKycDocument.countDocuments({ verificationStatus: "pending" }),
      SalesAgent.countDocuments()
    ]);
    return ok(res, { leadCount, bookingCount, kycPending, salesAgents });
  })
);

adminSalesRouter.get(
  "/sales/leads",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (_req, res) => {
    const leads = await Lead.find()
      .populate("salesAgentId", "agentCode fullName phone email status assignedAreas")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const customerUserIds = leads.map((lead) => lead.customerUserId).filter(Boolean);
    const mobiles = leads.map((lead) => normalizePhone(lead.mobile)).filter(Boolean);
    const bookingClauses = [
      customerUserIds.length ? { customerUserId: { $in: customerUserIds } } : null,
      mobiles.length ? { "personalDetails.mobile": { $in: mobiles } } : null
    ].filter(Boolean);
    const bookings = bookingClauses.length
      ? await ConnectionBooking.find({ $or: bookingClauses }).sort({ createdAt: -1 }).lean()
      : [];
    const bookingByLeadId = new Map();
    const bookingByCustomerUserId = new Map();
    const bookingByMobile = new Map();
    bookings.forEach((booking) => {
      if (booking.leadId && !bookingByLeadId.has(String(booking.leadId))) {
        bookingByLeadId.set(String(booking.leadId), booking);
      }
      if (booking.customerUserId && !bookingByCustomerUserId.has(String(booking.customerUserId))) {
        bookingByCustomerUserId.set(String(booking.customerUserId), booking);
      }
      const bookingMobile = normalizePhone(booking?.personalDetails?.mobile);
      if (bookingMobile && !bookingByMobile.has(bookingMobile)) {
        bookingByMobile.set(bookingMobile, booking);
      }
    });
    const planCodes = leads
      .map((lead) => lead?.selectedPlan?.planCode)
      .concat(bookings.map((booking) => booking?.selectedPlan?.planCode))
      .filter(Boolean);
    const plans = planCodes.length
      ? await PlanCatalog.find({ planCode: { $in: [...new Set(planCodes)] } }).lean()
      : [];
    const planByCode = new Map();
    plans.forEach((plan) => {
      if (plan?.planCode) {
        planByCode.set(String(plan.planCode), plan);
      }
      if (plan?.name) {
        planByCode.set(String(plan.name).toLowerCase(), plan);
      }
    });
    const enrichedLeads = leads.map((lead) => {
      const linkedBooking =
        bookingByLeadId.get(String(lead._id))
        || (lead.customerUserId ? bookingByCustomerUserId.get(String(lead.customerUserId)) : null)
        || bookingByMobile.get(normalizePhone(lead.mobile))
        || null;
      const resolvedPlanKey =
        lead?.selectedPlan?.planCode
        || lead?.requestedPlanCode
        || linkedBooking?.selectedPlan?.planCode
        || lead?.selectedPlan?.planName
        || lead?.requestedPlanName
        || linkedBooking?.selectedPlan?.planName
        || "";
      return mergeLeadPlanDetails(
        lead,
        linkedBooking,
        planByCode.get(String(resolvedPlanKey)) || planByCode.get(String(resolvedPlanKey).toLowerCase()) || null
      );
    });
    return ok(res, enrichedLeads);
  })
);

adminSalesRouter.get(
  "/sales/bookings",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (_req, res) => {
    const bookings = await ConnectionBooking.find().sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, bookings);
  })
);

adminSalesRouter.get(
  "/sales/agents",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (_req, res) => {
    const agents = await SalesAgent.find().sort({ createdAt: -1 }).lean();
    return ok(res, agents);
  })
);

adminSalesRouter.post(
  "/sales/leads",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const fullName = String(req.body?.fullName || "").trim();
    const mobile = String(req.body?.mobile || "").trim();
    if (!fullName || !mobile) {
      throw new ApiError(400, "Full name and mobile are required");
    }

    const leadNumber = await createUniqueLeadNumber();
    const lead = await Lead.create({
      leadNumber,
      type: "sales_created",
      source: "field_sales",
      status: String(req.body?.status || "new").trim() || "new",
      leadCategory: String(req.body?.leadCategory || "home").trim() === "business" ? "business" : "home",
      fullName,
      companyName: String(req.body?.companyName || "").trim() || undefined,
      mobile,
      alternateMobile: String(req.body?.alternateMobile || "").trim() || undefined,
      email: String(req.body?.email || "").trim() || undefined,
      address: String(req.body?.address || "").trim() || undefined,
      pinCode: String(req.body?.pinCode || "").trim() || undefined,
      zoneId: String(req.body?.zoneId || "").trim() || undefined,
      feasible: typeof req.body?.feasible === "boolean" ? req.body.feasible : undefined,
      requestedPlanCode: String(req.body?.requestedPlanCode || "").trim() || undefined,
      requestedPlanName: String(req.body?.requestedPlanName || "").trim() || undefined,
      requestedPlanAmount: Number(req.body?.requestedPlanAmount || 0) || undefined,
      requestedDurationMonths: Number(req.body?.requestedDurationMonths || 0) || undefined,
      requestedDurationLabel: String(req.body?.requestedDurationLabel || "").trim() || undefined,
      requirementSummary: String(req.body?.requirementSummary || "").trim() || undefined,
      preferredVisitAt: req.body?.preferredVisitAt ? new Date(String(req.body.preferredVisitAt)) : undefined,
      notes: String(req.body?.notes || "").trim() || undefined,
      salesAgentId: String(req.body?.salesAgentId || "").trim() || undefined,
    });

    appendLeadActivity(lead, "lead_created", "Lead created from admin sales desk", {
      leadCategory: lead.leadCategory,
      source: lead.source,
    });
    await lead.save();

    const reloadedLead = await Lead.findById(lead._id)
      .populate("salesAgentId", "agentCode fullName phone email status assignedAreas")
      .lean();
    return ok(res, reloadedLead, { created: true });
  })
);

adminSalesRouter.patch(
  "/sales/leads/:leadId/assign",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) {
      throw new ApiError(404, "Lead not found");
    }
    const nextSalesAgentId = String(req.body?.salesAgentId || "").trim();
    if (!nextSalesAgentId) {
      const previousSalesAgent = lead.salesAgentId ? String(lead.salesAgentId) : "";
      lead.salesAgentId = undefined;
      appendLeadActivity(lead, "assignment_removed", "Sales owner removed from lead", {
        previousSalesAgentId: previousSalesAgent || undefined
      });
      await lead.save();
      const reloadedLead = await Lead.findById(lead._id)
        .populate("salesAgentId", "agentCode fullName phone email status assignedAreas")
        .lean();
      return ok(res, reloadedLead);
    }
    const salesAgent = await SalesAgent.findOne({ _id: nextSalesAgentId, status: "active" }).lean();
    if (!salesAgent) {
      throw new ApiError(404, "Sales agent not found");
    }
    const previousSalesAgent = lead.salesAgentId ? String(lead.salesAgentId) : "";
    lead.salesAgentId = salesAgent._id;
    appendLeadActivity(lead, "assignment_updated", `Assigned to ${salesAgent.fullName || salesAgent.agentCode || "sales owner"}`, {
      previousSalesAgentId: previousSalesAgent || undefined,
      nextSalesAgentId: String(salesAgent._id)
    });
    await lead.save();
    const reloadedLead = await Lead.findById(lead._id)
      .populate("salesAgentId", "agentCode fullName phone email status assignedAreas")
      .lean();
    return ok(res, reloadedLead);
  })
);

adminSalesRouter.patch(
  "/sales/leads/:leadId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) {
      throw new ApiError(404, "Lead not found");
    }

    const nextStatus = String(req.body?.status || "").trim();
    const nextNotes = typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;
    const nextDropReason = typeof req.body?.dropReason === "string" ? req.body.dropReason.trim() : undefined;
    const rawFollowUpAt = String(req.body?.followUpAt || "").trim();

    if (nextStatus) {
      const allowedStatuses = ["new", "contacted", "interested", "kyc_pending", "feasible", "payment_pending", "converted", "dropped"];
      if (!allowedStatuses.includes(nextStatus)) {
        throw new ApiError(400, "Invalid lead status");
      }
      if (nextStatus !== lead.status) {
        appendLeadActivity(lead, "status_updated", `Stage moved to ${nextStatus.replace(/_/g, " ")}`, {
          previousStatus: lead.status,
          nextStatus
        });
      }
      lead.status = nextStatus;
    }

    if (nextNotes !== undefined) {
      if ((nextNotes || "") !== (lead.notes || "")) {
        appendLeadActivity(lead, "notes_updated", nextNotes ? "Lead notes updated" : "Lead notes cleared");
      }
      lead.notes = nextNotes || undefined;
    }

    if (nextDropReason !== undefined) {
      if ((nextDropReason || "") !== (lead.dropReason || "")) {
        appendLeadActivity(lead, "drop_reason_updated", nextDropReason ? "Drop reason updated" : "Drop reason cleared");
      }
      lead.dropReason = nextDropReason || undefined;
    }

    if (rawFollowUpAt) {
      const nextFollowUpAt = new Date(rawFollowUpAt);
      if (Number.isNaN(nextFollowUpAt.getTime())) {
        throw new ApiError(400, "Invalid follow-up date");
      }
      if (!lead.followUpAt || nextFollowUpAt.getTime() !== new Date(lead.followUpAt).getTime()) {
        appendLeadActivity(lead, "follow_up_updated", `Follow-up scheduled for ${nextFollowUpAt.toISOString()}`, {
          nextFollowUpAt: nextFollowUpAt.toISOString()
        });
      }
      lead.followUpAt = nextFollowUpAt;
    } else if (req.body && Object.prototype.hasOwnProperty.call(req.body, "followUpAt")) {
      if (lead.followUpAt) {
        appendLeadActivity(lead, "follow_up_cleared", "Follow-up schedule cleared");
      }
      lead.followUpAt = undefined;
    }

    await lead.save();
    const reloadedLead = await Lead.findById(lead._id)
      .populate("salesAgentId", "agentCode fullName phone email status assignedAreas")
      .lean();
    return ok(res, reloadedLead);
  })
);

adminSalesRouter.delete(
  "/sales/leads/:leadId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) throw new ApiError(404, "Lead not found");

    const linkedBookings = await ConnectionBooking.find({ leadId: lead._id })
      .select("bookingNumber status payment")
      .lean();
    const blockingBooking = linkedBookings.find((booking) => {
      const status = String(booking.status || "").toLowerCase();
      const paymentStatus = String(booking.payment?.status || "").toLowerCase();
      return (
        ["completed", "installed", "active", "assigned", "in_progress", "paid"].includes(status) ||
        paymentStatus === "paid"
      );
    });
    if (blockingBooking) {
      throw new ApiError(
        409,
        `Cannot delete lead while booking ${blockingBooking.bookingNumber || ""} is '${blockingBooking.status || "active"}'`
      );
    }

    await Promise.all([
      ConnectionBooking.deleteMany({ leadId: lead._id }),
      LeadKycDocument.deleteMany({
        $or: [
          { leadId: lead._id },
          ...(linkedBookings.length ? [{ connectionBookingId: { $in: linkedBookings.map((booking) => booking._id).filter(Boolean) } }] : []),
        ],
      }),
      Lead.deleteOne({ _id: lead._id }),
    ]);

    return ok(res, {
      deleted: true,
      leadId: String(lead._id),
      leadNumber: lead.leadNumber || "",
      removedBookings: linkedBookings.map((booking) => booking.bookingNumber).filter(Boolean),
    });
  })
);

adminSalesRouter.delete(
  "/sales/bookings/:bookingId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const booking = await ConnectionBooking.findById(req.params.bookingId);
    if (!booking) throw new ApiError(404, "Booking not found");
    const blocked = ["completed", "installed", "active"];
    if (blocked.includes(String(booking.status || "").toLowerCase())) {
      throw new ApiError(409, `Cannot delete a booking with status '${booking.status}'`);
    }
    await ConnectionBooking.deleteOne({ _id: booking._id });
    return ok(res, { deleted: true, bookingId: String(booking._id), bookingNumber: booking.bookingNumber });
  })
);

adminSalesRouter.post(
  "/sales/bookings/:bookingId/payment-link",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const booking = await ConnectionBooking.findById(req.params.bookingId).lean();
    if (!booking) throw new ApiError(404, "Booking not found");
    const amount =
      Number(req.body?.amount || 0) ||
      Number(booking.selectedPlan?.totalAmount || booking.selectedPlan?.amount || booking.payment?.amount || 0);
    if (!amount || amount <= 0) throw new ApiError(400, "A valid amount is required to generate the payment link");

    const link = await razorpayClient.createPaymentLink({
      amount,
      description: booking.selectedPlan?.planName
        ? `${booking.selectedPlan.planName} — Booking ${booking.bookingNumber}`
        : `Booking ${booking.bookingNumber}`,
      customerName: booking.personalDetails?.fullName || undefined,
      customerContact: booking.personalDetails?.mobile || undefined,
      customerEmail: booking.personalDetails?.email || undefined,
      referenceId: booking.bookingNumber,
      notes: { bookingId: String(booking._id), bookingNumber: booking.bookingNumber },
    });

    await ConnectionBooking.updateOne(
      { _id: booking._id },
      { $set: { "payment.razorpayPaymentLinkId": link.id, "payment.razorpayPaymentLinkUrl": link.short_url } }
    );

    return ok(res, { paymentLink: link.short_url, linkId: link.id, amount });
  })
);

adminSalesRouter.get(
  "/sales/kyc",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (_req, res) => {
    const items = await LeadKycDocument.find().sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, items);
  })
);

adminSalesRouter.get(
  "/sales/plans",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (_req, res) => {
    const plans = await PlanCatalog.find().sort({ sortOrder: 1 }).lean();
    return ok(res, plans);
  })
);

adminSalesRouter.get(
  "/sales/banners",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (_req, res) => {
    const banners = await AppBanner.find().sort({ sortOrder: 1 }).lean();
    return ok(res, banners);
  })
);

async function getLeadCafSettings() {
  const [prefixConfig, templateConfig] = await Promise.all([
    SystemConfig.findOne({ key: "settings.prefix_settings" }).lean(),
    SystemConfig.findOne({ key: "settings.additional_fields" }).lean()
  ]);
  const prefixValue = prefixConfig?.value?.caf?.prefix || "CAF-";
  const templates = Array.isArray(prefixConfig?.value?.caf?.templates)
    ? prefixConfig.value.caf.templates
    : (Array.isArray(templateConfig?.value?.cafTemplates) ? templateConfig.value.cafTemplates : []);
  const selectedTemplate = templates[0] || {};
  return {
    prefix: String(prefixValue || "CAF-").trim() || "CAF-",
    template: {
      brandName: selectedTemplate.brandName || selectedTemplate.companyName || "Netlayer India Private Limited",
      cafTitle: selectedTemplate.cafTitle || "Customer Application Form",
      accentColor: selectedTemplate.accentColor || "#1d4ed8",
      companyAddress: selectedTemplate.companyAddress || "",
      website: selectedTemplate.website || "https://netlayer.in",
      termsUrl: selectedTemplate.termsUrl || "https://netlayer.in/terms-and-conditions",
      footerLeftLabel: selectedTemplate.footerLeftLabel || "ERP Name",
      footerLeftValue: selectedTemplate.footerLeftValue || "Netlayer ERP",
      footerRightLabel: selectedTemplate.footerRightLabel || "Sales Executive",
      footerRightValue: selectedTemplate.footerRightValue || "Assigned Agent",
      declarationText: selectedTemplate.declarationText || "I confirm that I have read the general terms and conditions and accept them."
    }
  };
}

function formatLeadDate(value) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function renderLeadCafPdf({ lead, kycDoc, template, prefix }) {
  const pdf = new PDFDocument({ size: "A4", margin: 42 });
  const accent = template.accentColor || "#1d4ed8";

  const sectionHeader = (label) => {
    pdf.moveDown(0.8);
    const y = pdf.y;
    pdf.roundedRect(42, y, 511, 22, 8).fill(accent);
    pdf.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10).text(label, 54, y + 7);
    pdf.fillColor("#0f172a");
    pdf.moveDown(1.2);
  };

  const tripleRow = (items) => {
    const startY = pdf.y;
    const widths = [160, 160, 160];
    let x = 42;
    items.forEach(([label, value], index) => {
      pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text(label.toUpperCase(), x, startY, { width: widths[index] });
      pdf.font("Helvetica").fontSize(10).fillColor("#0f172a").text(value || "N/A", x, startY + 14, { width: widths[index] });
      x += widths[index] + 15;
    });
    pdf.y = startY + 34;
  };

  const row = (label, value) => {
    const y = pdf.y;
    pdf.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text(label, 42, y, { width: 155 });
    pdf.font("Helvetica").fontSize(10).fillColor("#0f172a").text(value || "N/A", 200, y, { width: 353 });
    pdf.moveTo(42, y + 18).lineTo(553, y + 18).strokeColor("#e2e8f0").stroke();
    pdf.y = y + 24;
  };

  const cafNumber = `${prefix}${lead.leadNumber || String(lead._id).slice(-6).toUpperCase()}`;

  pdf.rect(0, 0, 595, 842).fill("#ffffff");
  pdf.fillColor("#0f172a");

  pdf.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text(template.brandName || "Netlayer India Private Limited", 42, 42, { width: 300 });
  pdf.font("Helvetica").fontSize(9).fillColor("#64748b").text(template.companyAddress || "", 42, 68, { width: 300 });
  pdf.font("Helvetica").fontSize(9).fillColor("#64748b").text(template.website || "", 42, 92, { width: 300 });

  pdf.roundedRect(380, 42, 173, 62, 12).fill("#f8fafc");
  pdf.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text(template.cafTitle || "Customer Application Form", 394, 55, { width: 145, align: "right" });
  pdf.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text(cafNumber, 394, 70, { width: 145, align: "right" });
  pdf.fillColor("#64748b").font("Helvetica").fontSize(8).text(`Date: ${formatLeadDate(lead.createdAt)}`, 394, 88, { width: 145, align: "right" });

  pdf.y = 132;
  pdf.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16).text(lead.fullName || "Applicant");
  pdf.moveDown(0.5);
  tripleRow([
    ["Lead Number", lead.leadNumber || "N/A"],
    ["Category", lead.leadCategory === "business" ? "Business" : "Home"],
    ["Status", String(lead.status || "new").replace(/_/g, " ")]
  ]);
  tripleRow([
    ["Mobile", lead.mobile || "N/A"],
    ["Email", lead.email || "N/A"],
    ["Alternate Mobile", lead.alternateMobile || "N/A"]
  ]);

  sectionHeader("Address for Installation");
  row("Address", lead.address || "N/A");
  tripleRow([
    ["PIN Code", lead.pinCode || "N/A"],
    ["Zone", lead.zoneId || "N/A"],
    ["Lead Type", lead.leadCategory === "business" ? "Business Broadband" : "Home Broadband"]
  ]);

  sectionHeader("Plan Details");
  const planName = lead.selectedPlan?.planName || lead.requestedPlanName || "N/A";
  const planAmount = lead.selectedPlan?.amount || lead.requestedPlanAmount || "N/A";
  const planDuration = lead.selectedPlan?.durationLabel || lead.requestedDurationLabel || "N/A";
  row("Plan Offer", planName);
  row("Plan Duration", String(planDuration));
  row("Plan Price", planAmount ? `Rs ${Number(planAmount).toFixed(2)}` : "N/A");

  sectionHeader("KYC Document");
  tripleRow([
    ["Document Type", kycDoc?.documentType ? kycDoc.documentType.toUpperCase() : "Aadhaar Card"],
    ["Document Number", kycDoc?.documentNumber || "N/A"],
    ["Verification Status", kycDoc?.verificationStatus ? kycDoc.verificationStatus.charAt(0).toUpperCase() + kycDoc.verificationStatus.slice(1) : "Pending"]
  ]);

  pdf.moveDown(0.8);
  pdf.roundedRect(42, pdf.y, 511, 52, 12).fill("#f8fafc");
  pdf.fillColor("#334155").font("Helvetica").fontSize(9).text(template.declarationText || "", 56, pdf.y - 42 + 14, { width: 480 });
  pdf.fillColor(accent).font("Helvetica-Bold").fontSize(9).text(template.termsUrl || "", 56, pdf.y - 42 + 34, { width: 480 });
  pdf.moveDown(3.2);

  pdf.moveTo(42, pdf.y).lineTo(553, pdf.y).dash(3, { space: 3 }).strokeColor("#cbd5e1").stroke().undash();
  pdf.moveDown(0.8);
  pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text((template.footerLeftLabel || "ERP Name").toUpperCase(), 42, pdf.y, { width: 200 });
  pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text((template.footerRightLabel || "Sales Executive").toUpperCase(), 353, pdf.y, { width: 200, align: "right" });
  pdf.moveDown(0.3);
  pdf.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(template.footerLeftValue || "Netlayer ERP", 42, pdf.y, { width: 200 });
  pdf.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(template.footerRightValue || "Assigned Agent", 353, pdf.y - 10, { width: 200, align: "right" });

  pdf.end();
  return pdf;
}

adminSalesRouter.post(
  "/sales/leads/:leadId/kyc",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) throw new ApiError(404, "Lead not found");

    const aadhaarFront = String(req.body?.aadhaarFront || "").trim() || undefined;
    const aadhaarBack = String(req.body?.aadhaarBack || "").trim() || undefined;
    const selfie = String(req.body?.selfie || "").trim() || undefined;
    const documentNumber = String(req.body?.documentNumber || "").trim() || undefined;

    let kycDoc = await LeadKycDocument.findOne({ leadId: lead._id });
    let isCreated = false;
    if (kycDoc) {
      if (aadhaarFront) kycDoc.frontImageUrl = aadhaarFront;
      if (aadhaarBack) kycDoc.backImageUrl = aadhaarBack;
      if (selfie) kycDoc.selfieImageUrl = selfie;
      if (documentNumber) kycDoc.documentNumber = documentNumber;
      await kycDoc.save();
    } else {
      kycDoc = await LeadKycDocument.create({
        leadId: lead._id,
        documentType: "aadhaar",
        frontImageUrl: aadhaarFront,
        backImageUrl: aadhaarBack,
        selfieImageUrl: selfie,
        documentNumber
      });
      isCreated = true;
    }

    if (lead.kycStatus === "pending" || !lead.kycStatus) {
      lead.kycStatus = "submitted";
      appendLeadActivity(lead, "kyc_submitted", "KYC documents submitted");
      await lead.save();
    }

    return ok(res, kycDoc.toObject(), { created: isCreated });
  })
);

adminSalesRouter.get(
  "/sales/leads/:leadId/kyc",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (req, res) => {
    const kycDoc = await LeadKycDocument.findOne({ leadId: req.params.leadId }).lean();
    if (!kycDoc) throw new ApiError(404, "No KYC document found for this lead");
    return ok(res, kycDoc);
  })
);

adminSalesRouter.get(
  "/sales/leads/:leadId/caf/pdf",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.leadId).lean();
    if (!lead) throw new ApiError(404, "Lead not found");
    const kycDoc = await LeadKycDocument.findOne({ leadId: lead._id }).lean();
    const cafSettings = await getLeadCafSettings();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="CAF-${lead.leadNumber || lead._id}.pdf"`);
    return renderLeadCafPdf({ lead, kycDoc, template: cafSettings.template, prefix: cafSettings.prefix }).pipe(res);
  })
);
