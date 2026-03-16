import argon2 from "argon2";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { requireSalesAuth, signSalesAccessToken, signSalesRefreshToken } from "../../common/salesAuth.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { Lead } from "../../models/Lead.js";
import { LeadKycDocument } from "../../models/LeadKycDocument.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { SalesAgent } from "../../models/SalesAgent.js";
import { salesKycSchema, salesLeadSchema, salesLoginSchema } from "./schemas.js";

export const salesAppRouter = Router();

salesAppRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const payload = salesLoginSchema.parse(req.body);
    const agent = await SalesAgent.findOne({
      $or: [{ phone: payload.login }, { email: payload.login }, { agentCode: payload.login }]
    });
    if (!agent || !(await argon2.verify(agent.passwordHash, payload.password))) {
      throw new ApiError(401, "Invalid sales credentials");
    }
    return ok(res, {
      accessToken: signSalesAccessToken(agent),
      refreshToken: signSalesRefreshToken(agent)
    });
  })
);

salesAppRouter.get(
  "/dashboard",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    const [myLeads, converted, kycPending] = await Promise.all([
      Lead.countDocuments({ salesAgentId: req.salesAgent._id }),
      Lead.countDocuments({ salesAgentId: req.salesAgent._id, status: "converted" }),
      Lead.countDocuments({ salesAgentId: req.salesAgent._id, kycStatus: { $in: ["pending", "submitted"] } })
    ]);
    return ok(res, { myLeads, converted, kycPending });
  })
);

salesAppRouter.post(
  "/leads",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    const payload = salesLeadSchema.parse(req.body);
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode });
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const lead = await Lead.create({
      leadNumber: `LD${Date.now().toString().slice(-6)}`,
      type: "sales_created",
      status: "kyc_pending",
      source: "field_sales",
      salesAgentId: req.salesAgent._id,
      fullName: payload.fullName,
      mobile: payload.mobile,
      email: payload.email,
      address: payload.address,
      pinCode: payload.pinCode,
      gps: { lat: payload.lat, lng: payload.lng },
      feasible: true,
      selectedPlan: {
        planCode: plan.planCode,
        planName: plan.name,
        amount: (plan.monthlyPrice || 0) + (plan.otcCharge || 0)
      },
      notes: payload.notes
    });
    return ok(res, lead, { created: true });
  })
);

salesAppRouter.get(
  "/leads",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    const leads = await Lead.find({ salesAgentId: req.salesAgent._id }).sort({ createdAt: -1 }).lean();
    return ok(res, leads);
  })
);

salesAppRouter.post(
  "/leads/:leadId/kyc",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    const payload = salesKycSchema.parse(req.body);
    const lead = await Lead.findOne({ _id: req.params.leadId, salesAgentId: req.salesAgent._id });
    if (!lead) {
      throw new ApiError(404, "Lead not found");
    }
    const doc = await LeadKycDocument.create({
      leadId: lead._id,
      ...payload,
      verificationStatus: "pending"
    });
    lead.kycStatus = "submitted";
    await lead.save();
    return ok(res, doc, { created: true });
  })
);

salesAppRouter.post(
  "/leads/:leadId/convert",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    const lead = await Lead.findOne({ _id: req.params.leadId, salesAgentId: req.salesAgent._id });
    if (!lead) {
      throw new ApiError(404, "Lead not found");
    }
    const booking = await ConnectionBooking.create({
      bookingNumber: `JF${Date.now().toString().slice(-6)}`,
      leadId: lead._id,
      status: "payment_pending",
      source: "sales_app",
      selectedPlan: lead.selectedPlan,
      personalDetails: {
        fullName: lead.fullName,
        mobile: lead.mobile,
        email: lead.email,
        fullAddress: lead.address,
        pinCode: lead.pinCode
      },
      feasibility: {
        feasible: lead.feasible,
        gps: lead.gps
      },
      tracking: {
        currentStep: "booking_placed",
        steps: [{ code: "booking_placed", status: "done", at: new Date() }]
      }
    });
    lead.status = "converted";
    lead.convertedBookingId = booking._id;
    await lead.save();
    return ok(res, booking);
  })
);
