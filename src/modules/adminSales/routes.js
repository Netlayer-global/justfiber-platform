import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
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
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(100).lean();
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
