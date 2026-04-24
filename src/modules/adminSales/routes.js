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
    return ok(res, leads);
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
