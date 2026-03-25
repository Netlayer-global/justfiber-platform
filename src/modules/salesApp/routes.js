import argon2 from "argon2";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { requireSalesAuth, signSalesAccessToken, signSalesRefreshToken } from "../../common/salesAuth.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { Installer } from "../../models/Installer.js";
import { InstallerJob } from "../../models/InstallerJob.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { Lead } from "../../models/Lead.js";
import { LeadKycDocument } from "../../models/LeadKycDocument.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { SalesAgent } from "../../models/SalesAgent.js";
import { isPlanProvisioningReady } from "../../common/networkProvisioning.js";
import { salesBookingPaymentConfirmSchema, salesBookingPaymentLinkSchema, salesKycSchema, salesLeadSchema, salesLoginSchema } from "./schemas.js";

export const salesAppRouter = Router();

async function ensureSalesBookingOwnership(bookingId, salesAgentId) {
  const booking = await ConnectionBooking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  if (!booking.leadId) {
    throw new ApiError(403, "Booking is not owned by sales app flow");
  }
  const lead = await Lead.findOne({ _id: booking.leadId, salesAgentId });
  if (!lead) {
    throw new ApiError(403, "Booking does not belong to this sales agent");
  }
  return { booking, lead };
}

async function assignInstallerForSalesBooking(booking, lead) {
  if (booking.assignment?.installerId || booking.status === "assigned") {
    return booking;
  }
  const installer = await Installer.findOne({ availabilityStatus: "available", status: "active" }).sort({ updatedAt: 1 });
  if (!installer) {
    booking.status = "awaiting_assignment";
    booking.tracking = {
      currentStep: "payment_confirmed",
      steps: [
        { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
        { code: "payment_confirmed", status: "done", at: new Date() },
        { code: "installer_assigned", status: "pending", at: null }
      ]
    };
    await booking.save();
    return booking;
  }

  const installerJob = await InstallerJob.create({
    jobNumber: `JOB-${Date.now()}`,
    type: "installation",
    customerId: booking.bookingNumber,
    serviceId: booking.bookingNumber,
    installerId: installer._id,
    priority: "medium",
    customerSnapshot: {
      fullName: lead.fullName,
      phone: lead.mobile,
      address: lead.address,
      location: lead.gps,
      planName: lead.selectedPlan?.planName,
      planCode: lead.selectedPlan?.planCode
    },
    timeline: [
      {
        event: "job.assigned",
        actorType: "system",
        actorId: "sales-booking-engine",
        note: `Auto-assigned from sales booking ${booking.bookingNumber}`
      }
    ]
  });

  booking.status = "assigned";
  booking.assignment = {
    installerId: installer._id,
    assignedAt: new Date(),
    autoAssigned: true
  };
  booking.tracking = {
    currentStep: "installer_assigned",
    steps: [
      { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
      { code: "payment_confirmed", status: "done", at: new Date() },
      { code: "installer_assigned", status: "done", at: new Date(), jobId: installerJob._id }
    ]
  };
  await booking.save();

  await InstallerNotification.create({
    installerId: installer._id,
    type: "new_job",
    title: "New sales booking assigned",
    body: `${lead.fullName} installation has been assigned.`,
    payload: { bookingNumber: booking.bookingNumber, installerJobId: installerJob._id }
  });

  return booking;
}

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
  "/plans",
  requireSalesAuth,
  asyncHandler(async (_req, res) => {
    const plans = (await PlanCatalog.find({ active: true, archivedAt: { $exists: false } }).sort({ sortOrder: 1 }).lean()).filter(isPlanProvisioningReady);
    return ok(res, plans);
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
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true });
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

salesAppRouter.get(
  "/bookings",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    const leadIds = await Lead.find({ salesAgentId: req.salesAgent._id }).distinct("_id");
    const bookings = await ConnectionBooking.find({ leadId: { $in: leadIds } }).sort({ createdAt: -1 }).lean();
    return ok(res, bookings);
  })
);

salesAppRouter.post(
  "/bookings/:bookingId/payment/link",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    salesBookingPaymentLinkSchema.parse(req.body || {});
    throw new ApiError(410, "Direct sales booking payment link creation is disabled. Use internal billing flow.");
  })
);

salesAppRouter.post(
  "/bookings/:bookingId/payment/link-jaze",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    salesBookingPaymentLinkSchema.parse(req.body || {});
    throw new ApiError(410, "Jaze sales payment has been removed. Use internal billing flow.");
  })
);

salesAppRouter.post(
  "/bookings/:bookingId/payment/confirm",
  requireSalesAuth,
  asyncHandler(async (req, res) => {
    const payload = salesBookingPaymentConfirmSchema.parse(req.body || {});
    const { booking, lead } = await ensureSalesBookingOwnership(req.params.bookingId, req.salesAgent._id);

    booking.payment = {
      ...(booking.payment || {}),
      provider: "internal_platform",
      status: payload.status,
      paymentId: payload.paymentId,
      reference: payload.reference,
      notes: payload.notes,
      paidAt: payload.status === "paid" ? new Date() : null
    };

    if (payload.status === "failed") {
      booking.status = "payment_pending";
      await booking.save();
      return ok(res, { bookingId: booking._id, bookingNumber: booking.bookingNumber, status: booking.status, payment: booking.payment });
    }

    const transactionId = payload.paymentId || `SALES-${booking.bookingNumber}-${Date.now()}`;
    const existingPayment = await PaymentTransaction.findOne({ transactionId }).lean();
    if (!existingPayment) {
      await PaymentTransaction.create({
        transactionId,
        customerId: booking.personalDetails?.mobile || booking.bookingNumber,
        serviceId: booking.bookingNumber,
        provider: "internal_platform",
        amount: payload.amount || booking.selectedPlan?.amount || booking.selectedPlan?.totalAmount || 0,
        status: "success",
        paidAt: new Date(),
        method: "onlinePayment",
        reference: payload.reference || payload.paymentId,
        metadata: { source: "sales_booking", bookingNumber: booking.bookingNumber }
      });
    }

    await assignInstallerForSalesBooking(booking, lead);
    return ok(res, {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      payment: booking.payment,
      assignment: booking.assignment
    });
  })
);
