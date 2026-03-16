import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { persistCustomerSession, requireCustomerAuth, signCustomerAccessToken, signCustomerRefreshToken } from "../../common/customerAuth.js";
import { AppBanner } from "../../models/AppBanner.js";
import { AddonCatalog } from "../../models/AddonCatalog.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { Customer } from "../../models/Customer.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";
import { CustomerUser } from "../../models/CustomerUser.js";
import { InstallerJob } from "../../models/InstallerJob.js";
import { Installer } from "../../models/Installer.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import {
  addonRequestSchema,
  bookingSchema,
  feasibilitySchema,
  planChangeSchema,
  sendOtpSchema,
  serviceRequestSchema,
  supportTicketSchema,
  verifyOtpSchema,
  wifiUpdateSchema
} from "./schemas.js";

const otpStore = new Map();

export const customerPortalRouter = Router();

customerPortalRouter.post(
  "/auth/send-otp",
  asyncHandler(async (req, res) => {
    const payload = sendOtpSchema.parse(req.body);
    if (!payload.mobile && !payload.email) {
      throw new ApiError(400, "Mobile or email required");
    }
    const key = payload.mobile || payload.email;
    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    otpStore.set(key, otp);
    return ok(res, { sent: true, demoOtp: otp });
  })
);

customerPortalRouter.post(
  "/auth/verify-otp",
  asyncHandler(async (req, res) => {
    const payload = verifyOtpSchema.parse(req.body);
    const key = payload.mobile || payload.email;
    if (!key || otpStore.get(key) !== payload.otp) {
      throw new ApiError(400, "Invalid OTP");
    }
    let user = await CustomerUser.findOne({
      $or: [{ mobile: payload.mobile }, { email: payload.email }]
    });
    if (!user) {
      user = await CustomerUser.create({
        mobile: payload.mobile,
        email: payload.email,
        fullName: payload.fullName,
        authMode: payload.mobile ? "mobile_otp" : "email_otp"
      });
    }
    const accessToken = signCustomerAccessToken(user);
    const refreshToken = signCustomerRefreshToken(user);
    await persistCustomerSession({ user, refreshToken });
    await CustomerNotification.updateOne(
      { customerUserId: user._id, title: "Welcome to Justfiber" },
      {
        $setOnInsert: {
          customerUserId: user._id,
          type: "welcome",
          title: "Welcome to Justfiber",
          body: "Use the dashboard to book a connection, manage billing, and track service requests."
        }
      },
      { upsert: true }
    );
    return ok(res, { accessToken, refreshToken });
  })
);

customerPortalRouter.get(
  "/banners",
  asyncHandler(async (_req, res) => {
    const banners = await AppBanner.find({ active: true }).sort({ sortOrder: 1 }).lean();
    return ok(res, banners);
  })
);

customerPortalRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await PlanCatalog.find({ active: true }).sort({ sortOrder: 1 }).lean();
    return ok(res, plans);
  })
);

customerPortalRouter.post(
  "/feasibility/check",
  asyncHandler(async (req, res) => {
    const payload = feasibilitySchema.parse(req.body);
    const feasible = payload.lat > 0 && payload.lng > 0;
    return ok(res, {
      feasible,
      serviceStatus: feasible ? "active" : "coming_soon",
      message: feasible ? "Area serviceable" : "We are not available here yet. Coming soon."
    });
  })
);

customerPortalRouter.post(
  "/bookings",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingSchema.parse(req.body);
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode });
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const booking = await ConnectionBooking.create({
      bookingNumber: `JF${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      status: "payment_pending",
      selectedPlan: {
        planCode: plan.planCode,
        planName: plan.name,
        monthlyPrice: plan.monthlyPrice,
        otcCharge: plan.otcCharge,
        totalAmount: (plan.monthlyPrice || 0) + (plan.otcCharge || 0)
      },
      feasibility: {
        feasible: true,
        gps: { lat: payload.lat, lng: payload.lng }
      },
      personalDetails: {
        fullName: payload.fullName,
        mobile: payload.mobile,
        email: payload.email,
        fullAddress: payload.fullAddress,
        pinCode: payload.pinCode
      },
      payment: {
        provider: payload.paymentMode,
        status: "paid",
        amount: (plan.monthlyPrice || 0) + (plan.otcCharge || 0),
        paidAt: new Date()
      },
      tracking: {
        currentStep: "payment_confirmed",
        steps: [
          { code: "booking_placed", status: "done", at: new Date() },
          { code: "payment_confirmed", status: "done", at: new Date() },
          { code: "installer_assigned", status: "pending", at: null }
        ]
      }
    });
    const installer = await Installer.findOne({ availabilityStatus: "available", status: "active" }).sort({ updatedAt: 1 });
    if (installer) {
      const installerJob = await InstallerJob.create({
        jobNumber: `JOB-${Date.now()}`,
        type: "installation",
        customerId: booking.bookingNumber,
        serviceId: booking.bookingNumber,
        installerId: installer._id,
        priority: "medium",
        customerSnapshot: {
          fullName: payload.fullName,
          phone: payload.mobile,
          address: payload.fullAddress,
          location: { lat: payload.lat, lng: payload.lng },
          planName: plan.name,
          planCode: plan.planCode
        },
        timeline: [
          {
            event: "job.assigned",
            actorType: "system",
            actorId: "booking-engine",
            note: `Auto-assigned from booking ${booking.bookingNumber}`
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
          { code: "booking_placed", status: "done", at: booking.createdAt },
          { code: "payment_confirmed", status: "done", at: new Date() },
          { code: "installer_assigned", status: "done", at: new Date(), jobId: installerJob._id }
        ]
      };
      await booking.save();
      await InstallerNotification.create({
        installerId: installer._id,
        type: "new_job",
        title: "New booking assigned",
        body: `${payload.fullName} installation has been assigned.`,
        payload: { bookingNumber: booking.bookingNumber, installerJobId: installerJob._id }
      });
    } else {
      booking.status = "awaiting_assignment";
      await booking.save();
    }
    req.customerUser.state = "booking_in_progress";
    req.customerUser.fullName = payload.fullName;
    await req.customerUser.save();
    return ok(res, booking, { created: true });
  })
);

customerPortalRouter.get(
  "/bookings/:bookingNumber/tracking",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const booking = await ConnectionBooking.findOne({
      bookingNumber: req.params.bookingNumber,
      customerUserId: req.customerUser._id
    }).lean();
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }
    return ok(res, booking.tracking || {});
  })
);

customerPortalRouter.get(
  "/dashboard",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const existingCustomerId = req.customerUser.linkedCustomerIds?.[0];
    if (!existingCustomerId) {
      const latestBooking = await ConnectionBooking.findOne({ customerUserId: req.customerUser._id }).sort({ createdAt: -1 }).lean();
      return ok(res, {
        state: req.customerUser.state,
        bookNow: true,
        latestBooking
      });
    }
    const customer = await Customer.findOne({ customerId: existingCustomerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Linked customer not found");
    }
    return ok(res, {
      state: "active_customer",
      customerId: customer.customerId,
      currentPlan: customer.planName,
      remainingDays: customer.expiryAt ? Math.max(0, Math.ceil((new Date(customer.expiryAt) - Date.now()) / (1000 * 60 * 60 * 24))) : null,
      billDueAmount: customer.billingSnapshot?.lastInvoiceAmount || 0,
      dataLeftMb: 0,
      status: customer.operationalStatus,
      quickActions: ["pay_bill", "wifi_settings", "router_reboot", "raise_complaint", "change_plan"],
      payBill: true,
      viewDetails: true
    });
  })
);

customerPortalRouter.get(
  "/services/track",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const jobs = await InstallerJob.find({
      customerId: { $in: req.customerUser.linkedCustomerIds || [] }
    }).sort({ createdAt: -1 }).limit(20).lean();
    return ok(res, jobs);
  })
);

customerPortalRouter.get(
  "/billing/summary",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.customerUser.linkedCustomerIds?.[0] }).lean();
    if (!customer) {
      throw new ApiError(404, "Billing summary not available");
    }
    return ok(res, {
      currentPlan: customer.planName,
      dueDate: customer.expiryAt,
      billCycle: "Monthly",
      billMode: "Prepaid",
      generatedDate: customer.updatedAt,
      amount: customer.billingSnapshot?.lastInvoiceAmount || 0,
      paymentStatus: customer.billingSnapshot?.lastPaymentStatus || "unknown"
    });
  })
);

customerPortalRouter.get(
  "/wifi",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.customerUser.linkedCustomerIds?.[0] }).lean();
    return ok(res, {
      sameSsidMode: true,
      ssid24: customer?.fullName ? `${customer.fullName.split(" ")[0]}-2.4G` : "Justfiber-Home-2.4G",
      ssid5: customer?.fullName ? `${customer.fullName.split(" ")[0]}-5G` : "Justfiber-Home-5G",
      connectedDevices: 4,
      natEnabled: true
    });
  })
);

customerPortalRouter.post(
  "/wifi/update",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = wifiUpdateSchema.parse(req.body);
    return ok(res, {
      updated: true,
      requestedPayload: payload
    });
  })
);

customerPortalRouter.post(
  "/device/reboot",
  requireCustomerAuth,
  asyncHandler(async (_req, res) => {
    return ok(res, {
      queued: true,
      estimatedRecoverySeconds: 60
    });
  })
);

customerPortalRouter.get(
  "/device/connected-devices",
  requireCustomerAuth,
  asyncHandler(async (_req, res) => {
    return ok(res, [
      { name: "Samsung TV", connectionType: "wifi-5g", signal: "good" },
      { name: "Amit iPhone", connectionType: "wifi-5g", signal: "excellent" },
      { name: "Bedroom Camera", connectionType: "wifi-2g", signal: "fair" }
    ]);
  })
);

customerPortalRouter.get(
  "/notifications",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const items = await CustomerNotification.find({ customerUserId: req.customerUser._id }).sort({ createdAt: -1 }).limit(50).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/notifications/:id/read",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const notification = await CustomerNotification.findOneAndUpdate(
      { _id: req.params.id, customerUserId: req.customerUser._id },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();
    return ok(res, notification);
  })
);

customerPortalRouter.get(
  "/addons",
  requireCustomerAuth,
  asyncHandler(async (_req, res) => {
    const items = await AddonCatalog.find({ active: true }).sort({ category: 1, name: 1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/addons/request",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = addonRequestSchema.parse(req.body);
    const addon = await AddonCatalog.findOne({ addonCode: payload.addonCode, active: true }).lean();
    if (!addon) {
      throw new ApiError(404, "Add-on not found");
    }
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: req.customerUser.linkedCustomerIds?.[0],
      type: "addon_request",
      status: "open",
      payload: {
        addonCode: addon.addonCode,
        addonName: addon.name,
        quantity: payload.quantity
      },
      timeline: [{ event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() }]
    });
    return ok(res, request, { created: true });
  })
);

customerPortalRouter.get(
  "/plan/change-options",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.customerUser.linkedCustomerIds?.[0] }).lean();
    const plans = await PlanCatalog.find({ active: true }).sort({ sortOrder: 1 }).lean();
    return ok(res, {
      currentPlanCode: customer?.planCode || null,
      options: plans.filter((plan) => plan.planCode !== customer?.planCode)
    });
  })
);

customerPortalRouter.post(
  "/plan/change-request",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = planChangeSchema.parse(req.body);
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: req.customerUser.linkedCustomerIds?.[0],
      serviceId: req.customerUser.linkedCustomerIds?.[0],
      type: "plan_change",
      status: "open",
      payload: {
        planCode: plan.planCode,
        planName: plan.name,
        effectiveMode: payload.effectiveMode
      },
      timeline: [{ event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() }]
    });
    return ok(res, request, { created: true });
  })
);

customerPortalRouter.get(
  "/help/faqs",
  asyncHandler(async (_req, res) => {
    return ok(res, [
      { question: "How do I reboot my router?", answer: "Use the quick action in the Justfiber dashboard and wait about 60 seconds." },
      { question: "How do I change my Wi-Fi password?", answer: "Open Wi-Fi settings and update the SSID or password for 2.4G and 5G bands." },
      { question: "How do I pay my bill?", answer: "Use the billing section from the dashboard and tap Pay Now." }
    ]);
  })
);

customerPortalRouter.post(
  "/help/diagnose",
  requireCustomerAuth,
  asyncHandler(async (_req, res) => {
    return ok(res, {
      internetStatus: "reachable",
      wifiStatus: "stable",
      recommendation: "If speed feels low, try router reboot and test on 5 GHz."
    });
  })
);

customerPortalRouter.post(
  "/tickets",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = supportTicketSchema.parse(req.body);
    const customer = await Customer.findOne({ customerId: req.customerUser.linkedCustomerIds?.[0] }).lean();
    const ticket = await SupportTicket.create({
      ticketNumber: `TKT-${Date.now()}`,
      customerId: customer?.customerId || "UNLINKED",
      serviceId: customer?.serviceId,
      source: "customer_app",
      category: payload.category,
      priority: "medium",
      status: "open",
      subject: payload.subject,
      description: payload.description,
      timeline: [{ type: "created", actorType: "customer", actorId: req.customerUser._id.toString(), note: "Created from customer app" }]
    });
    return ok(res, ticket, { created: true });
  })
);

customerPortalRouter.get(
  "/tickets",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const items = await SupportTicket.find({ customerId: { $in: req.customerUser.linkedCustomerIds || [] } }).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.get(
  "/requests",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const items = await ServiceRequest.find({ customerUserId: req.customerUser._id }).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/requests",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = serviceRequestSchema.parse(req.body);
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: req.customerUser.linkedCustomerIds?.[0],
      type: payload.type,
      status: "open",
      payload: { note: payload.note, ...(payload.payload || {}) },
      timeline: [{ event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() }]
    });
    return ok(res, request, { created: true });
  })
);
