import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { AppBanner } from "../../models/AppBanner.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { Lead } from "../../models/Lead.js";
import { LeadKycDocument } from "../../models/LeadKycDocument.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { SalesAgent } from "../../models/SalesAgent.js";

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
    || bookingPlan?.preferredSlot
    || booking?.personalDetails?.preferredSlot
    || null;
  const planAmount =
    leadPlan?.amount
    || bookingPlan?.totalAmount
    || bookingPlan?.amount
    || booking?.payment?.amount
    || planCatalog?.monthlyPrice
    || planCatalog?.price
    || undefined;
  const durationMonths =
    leadPlan?.durationMonths
    || bookingPlan?.durationMonths
    || undefined;
  const durationLabel = String(
    leadPlan?.durationLabel
    || bookingPlan?.durationLabel
    || (durationMonths ? `${durationMonths} month${Number(durationMonths) > 1 ? "s" : ""}` : "")
  ).trim();
  return {
    ...lead,
    selectedPlan: {
      planCode: leadPlan?.planCode || bookingPlan?.planCode || planCatalog?.planCode || undefined,
      planName: leadPlan?.planName || bookingPlan?.planName || planCatalog?.name || undefined,
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
        || linkedBooking?.selectedPlan?.planCode
        || lead?.selectedPlan?.planName
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
      lead.salesAgentId = undefined;
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
    lead.salesAgentId = salesAgent._id;
    await lead.save();
    const reloadedLead = await Lead.findById(lead._id)
      .populate("salesAgentId", "agentCode fullName phone email status assignedAreas")
      .lean();
    return ok(res, reloadedLead);
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
