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
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { jazeClient } from "../../integrations/jazeClient.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";
import { detectOntBrand } from "../../common/networkProvisioning.js";
import {
  addonRequestSchema,
  bookingSchema,
  bookingPaymentConfirmSchema,
  bookingPaymentLinkSchema,
  billingPaymentConfirmSchema,
  billingPaymentLinkSchema,
  deviceAccessSchema,
  feasibilitySchema,
  guestWifiSchema,
  parentalControlSchema,
  planChangeSchema,
  sendOtpSchema,
  serviceRequestSchema,
  supportTicketSchema,
  verifyOtpSchema,
  wifiPauseSchema,
  wifiUpdateSchema
} from "./schemas.js";

const otpStore = new Map();

export const customerPortalRouter = Router();

function normalizeJazeUserId(raw) {
  if (!raw) return null;
  return String(raw).trim();
}

function deriveJazeUserId({ explicitJazeUserId, linkedCustomerId }) {
  if (explicitJazeUserId) {
    return normalizeJazeUserId(explicitJazeUserId);
  }
  if (!linkedCustomerId) {
    return null;
  }
  const match = String(linkedCustomerId).match(/(\d+)$/);
  return match ? match[1] : normalizeJazeUserId(linkedCustomerId);
}

function pickPaymentUrl(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidates = [
    payload.paymentUrl,
    payload.paymentLink,
    payload.payment_link,
    payload.gatewayUrl,
    payload.gateway_url,
    payload.checkoutUrl,
    payload.checkout_url,
    payload.payUrl,
    payload.pay_url,
    payload.url,
    payload.redirectUrl,
    payload.link,
    payload.data?.paymentUrl,
    payload.data?.paymentLink,
    payload.data?.payment_link,
    payload.data?.gatewayUrl,
    payload.data?.gateway_url,
    payload.data?.checkoutUrl,
    payload.data?.checkout_url,
    payload.data?.payUrl,
    payload.data?.pay_url,
    payload.data?.url
  ];
  const urls = candidates.filter((value) => typeof value === "string" && value.length > 0);
  const raw =
    urls.find((value) => /(payment|pay|checkout|bill)/i.test(value) && !/login/i.test(value)) ||
    urls.find((value) => !/login/i.test(value)) ||
    urls[0];
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function buildJazeUserCandidates({ explicitJazeUserId, customer }) {
  const rawCandidates = [
    explicitJazeUserId,
    customer?.customerId,
    customer?.accountNumber,
    customer?.serviceId,
    customer?.phone
  ];
  const derivedCandidates = rawCandidates.map((value) => deriveJazeUserId({ explicitJazeUserId: value }));
  return uniqueNonEmpty([...rawCandidates, ...derivedCandidates]);
}

function isPortalLoginUrl(url) {
  if (!url) return false;
  return /customer_portal/i.test(url) && /login|\/account\//i.test(url) && !/payment|checkout|bill/i.test(url);
}

async function resolveJazePaymentLink({ customer, explicitJazeUserId }) {
  const attemptedUserIds = [];
  let fallback = null;

  for (const userId of buildJazeUserCandidates({ explicitJazeUserId, customer })) {
    attemptedUserIds.push(userId);
    try {
      const gatewayPayload = await jazeClient.getPaymentLink({ userId });
      const paymentUrl = pickPaymentUrl(gatewayPayload);
      const result = {
        userId,
        paymentUrl,
        raw: gatewayPayload,
        attemptedUserIds: [...attemptedUserIds]
      };
      if (paymentUrl && !isPortalLoginUrl(paymentUrl)) {
        return result;
      }
      fallback ??= result;
    } catch (error) {
      fallback ??= {
        userId,
        paymentUrl: null,
        raw: { error: error.message },
        attemptedUserIds: [...attemptedUserIds]
      };
    }
  }

  return fallback || {
    userId: explicitJazeUserId || customer?.customerId || null,
    paymentUrl: null,
    raw: null,
    attemptedUserIds
  };
}

async function getOwnedBookingOrThrow(bookingNumber, customerUserId) {
  const booking = await ConnectionBooking.findOne({
    bookingNumber,
    customerUserId
  });
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  return booking;
}

async function getOwnedLinkedCustomer({ customerUser, requestedCustomerId }) {
  const linkedIds = customerUser.linkedCustomerIds || [];
  const customerId = requestedCustomerId || linkedIds[0];
  if (!customerId || !linkedIds.includes(customerId)) {
    throw new ApiError(404, "Linked customer not found");
  }
  const customer = await Customer.findOne({ customerId });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  return customer;
}

async function getLinkedCustomerAndDevice(customerUser) {
  const customerId = customerUser.linkedCustomerIds?.[0];
  if (!customerId) {
    throw new ApiError(404, "Linked customer not found");
  }
  const customer = await Customer.findOne({ customerId });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  const device = await DeviceOperationalCache.findOne({ customerId });
  return { customer, device };
}

function getConnectedDevices(device) {
  if (Array.isArray(device?.lanInfo?.connectedDevices) && device.lanInfo.connectedDevices.length > 0) {
    return device.lanInfo.connectedDevices.map((item, index) => ({
      clientId: item.clientId || item.macAddress || `client-${index + 1}`,
      name: item.name || `Connected Device ${index + 1}`,
      connectionType: item.connectionType || "wifi",
      signal: item.signal || "good",
      blocked: Boolean(item.blocked),
      macAddress: item.macAddress
    }));
  }
  return [
    { clientId: "tv-living", name: "Living Room TV", connectionType: "wifi-5g", signal: "good", blocked: false },
    { clientId: "phone-primary", name: "Primary Phone", connectionType: "wifi-5g", signal: "excellent", blocked: false }
  ];
}

function isMissingGenieDeviceError(error) {
  const message = String(error?.message || "");
  return message.includes("GenieACS request failed") && message.includes("No such device");
}

function estimateNetworkMetrics({ customer, device }) {
  const planSpeed = Number(customer?.billingSnapshot?.speedMbps || customer?.speedMbps || 100);
  const online = device?.onlineStatus === "online";
  const rxPower = Number(device?.opticalInfo?.rxPower ?? -22);
  const signalPenalty = rxPower < -26 ? 0.55 : rxPower < -23 ? 0.75 : 0.92;
  const blockedClients = getConnectedDevices(device).filter((item) => item.blocked).length;
  const speedMbps = online ? Math.max(5, Math.round(planSpeed * signalPenalty) - blockedClients * 2) : 0;
  const latencyMs = online ? Math.max(5, Math.round(8 + Math.abs(rxPower + 20) * 3)) : 999;
  const packetLossPercent = online ? Number((rxPower < -26 ? 2.8 : rxPower < -23 ? 1.2 : 0.2).toFixed(1)) : 100;
  return { speedMbps, latencyMs, packetLossPercent, rxPower };
}

async function notifyCustomerAction(customerUserId, type, title, body, payload) {
  await CustomerNotification.create({
    customerUserId,
    type,
    title,
    body,
    payload
  });
}

async function assignInstallerIfAvailable({ booking, payload, plan }) {
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
      { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
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

  return booking;
}

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
    const amount = (plan.monthlyPrice || 0) + (plan.otcCharge || 0);
    const isJazePayment = payload.paymentMode === "jaze";
    const linkedCustomerId = req.customerUser.linkedCustomerIds?.[0];
    const jazeUserId = deriveJazeUserId({
      explicitJazeUserId: payload.jazeUserId,
      linkedCustomerId
    });

    const booking = await ConnectionBooking.create({
      bookingNumber: `JF${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      status: "payment_pending",
      selectedPlan: {
        planCode: plan.planCode,
        planName: plan.name,
        monthlyPrice: plan.monthlyPrice,
        otcCharge: plan.otcCharge,
        totalAmount: amount
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
        status: isJazePayment ? "pending" : "paid",
        amount,
        paidAt: isJazePayment ? null : new Date(),
        jazeUserId: isJazePayment ? jazeUserId : undefined
      },
      tracking: {
        currentStep: isJazePayment ? "payment_pending" : "payment_confirmed",
        steps: [
          { code: "booking_placed", status: "done", at: new Date() },
          {
            code: "payment_confirmed",
            status: isJazePayment ? "pending" : "done",
            at: isJazePayment ? null : new Date()
          },
          { code: "installer_assigned", status: "pending", at: null }
        ]
      }
    });

    let paymentGateway = null;
    if (isJazePayment && jazeUserId) {
      try {
        const gatewayPayload = await jazeClient.getPaymentLink({ userId: jazeUserId });
        paymentGateway = {
          provider: "jaze",
          userId: jazeUserId,
          paymentUrl: pickPaymentUrl(gatewayPayload),
          raw: gatewayPayload
        };
        booking.payment = {
          ...(booking.payment || {}),
          paymentLink: paymentGateway.paymentUrl,
          paymentLinkPayload: gatewayPayload,
          linkRequestedAt: new Date()
        };
        await booking.save();
      } catch (error) {
        booking.payment = {
          ...(booking.payment || {}),
          gatewayError: error.message
        };
        await booking.save();
      }
    }

    if (!isJazePayment) {
      await assignInstallerIfAvailable({ booking, payload, plan });
    }

    req.customerUser.state = "booking_in_progress";
    req.customerUser.fullName = payload.fullName;
    await req.customerUser.save();

    const responseBooking = await ConnectionBooking.findById(booking._id).lean();
    return ok(
      res,
      {
        ...responseBooking,
        paymentGateway
      },
      { created: true }
    );
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

customerPortalRouter.post(
  "/bookings/:bookingNumber/payment/link-jaze",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingPaymentLinkSchema.parse(req.body || {});
    const booking = await getOwnedBookingOrThrow(req.params.bookingNumber, req.customerUser._id);
    if (booking.payment?.provider !== "jaze") {
      throw new ApiError(400, "This booking is not configured for JAZE payment");
    }
    const jazeUserId =
      deriveJazeUserId({
        explicitJazeUserId: payload.jazeUserId,
        linkedCustomerId: booking.payment?.jazeUserId
      }) || booking.payment?.jazeUserId;
    if (!jazeUserId) {
      throw new ApiError(400, "JAZE userId is required to generate payment link");
    }

    const gatewayPayload = await jazeClient.getPaymentLink({ userId: jazeUserId });
    const paymentUrl = pickPaymentUrl(gatewayPayload);

    booking.payment = {
      ...(booking.payment || {}),
      jazeUserId,
      paymentLink: paymentUrl,
      paymentLinkPayload: gatewayPayload,
      linkRequestedAt: new Date(),
      status: "pending"
    };
    await booking.save();

    return ok(res, {
      bookingNumber: booking.bookingNumber,
      provider: "jaze",
      userId: jazeUserId,
      paymentUrl,
      raw: gatewayPayload
    });
  })
);

customerPortalRouter.post(
  "/bookings/:bookingNumber/payment/confirm",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingPaymentConfirmSchema.parse(req.body);
    const booking = await getOwnedBookingOrThrow(req.params.bookingNumber, req.customerUser._id);

    booking.payment = {
      ...(booking.payment || {}),
      status: payload.status,
      paidAt: payload.status === "paid" ? new Date() : null,
      reference: payload.reference,
      paymentId: payload.paymentId,
      notes: payload.notes
    };

    if (payload.status === "failed") {
      booking.status = "payment_pending";
      booking.tracking = {
        currentStep: "payment_pending",
        steps: [
          { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
          { code: "payment_confirmed", status: "pending", at: null },
          { code: "installer_assigned", status: "pending", at: null }
        ]
      };
      await booking.save();
      return ok(res, {
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        payment: booking.payment
      });
    }

    await PaymentTransaction.create({
      transactionId: payload.paymentId || `JAZE-${booking.bookingNumber}-${Date.now()}`,
      customerId: booking.personalDetails?.mobile || booking.bookingNumber,
      serviceId: booking.bookingNumber,
      provider: "jaze",
      amount: payload.amount || booking.selectedPlan?.totalAmount || booking.payment?.amount || 0,
      status: "success",
      paidAt: new Date(),
      method: "onlinePayment",
      reference: payload.reference || payload.paymentId,
      metadata: {
        bookingNumber: booking.bookingNumber,
        source: "customer_app_booking"
      }
    }).catch(() => null);

    const plan = await PlanCatalog.findOne({ planCode: booking.selectedPlan?.planCode });
    if (!plan) {
      throw new ApiError(404, "Plan for booking not found");
    }

    await assignInstallerIfAvailable({
      booking,
      payload: {
        fullName: booking.personalDetails?.fullName,
        mobile: booking.personalDetails?.mobile,
        fullAddress: booking.personalDetails?.fullAddress,
        lat: booking.feasibility?.gps?.lat,
        lng: booking.feasibility?.gps?.lng
      },
      plan
    });

    return ok(res, {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      payment: booking.payment,
      assignment: booking.assignment
    });
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

customerPortalRouter.post(
  "/billing/payment/link-jaze",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = billingPaymentLinkSchema.parse(req.body || {});
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: payload.customerId
    });
    const gateway = await resolveJazePaymentLink({
      customer,
      explicitJazeUserId: payload.jazeUserId
    });

    return ok(res, {
      provider: "jaze",
      customerId: customer.customerId,
      userId: gateway.userId,
      amount: customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0,
      paymentUrl: gateway.paymentUrl,
      attemptedUserIds: gateway.attemptedUserIds,
      raw: gateway.raw
    });
  })
);

customerPortalRouter.post(
  "/billing/payment/confirm",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = billingPaymentConfirmSchema.parse(req.body || {});
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: payload.customerId
    });

    const amount =
      payload.amount || customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0;

    const transactionId = payload.paymentId || `JAZE-BILL-${customer.customerId}-${Date.now()}`;
    const existingPayment = await PaymentTransaction.findOne({ transactionId }).lean();
    if (existingPayment && existingPayment.customerId !== customer.customerId) {
      throw new ApiError(409, "Payment reference already used for another customer");
    }
    if (!existingPayment) {
      await PaymentTransaction.create({
        transactionId,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        provider: "jaze",
        amount,
        status: "success",
        paidAt: new Date(),
        method: "onlinePayment",
        reference: payload.reference || payload.paymentId,
        metadata: {
          source: "customer_billing",
          notes: payload.notes
        }
      });
    }

    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      lastInvoiceAmount: amount,
      dueAmount: 0,
      lastPaymentStatus: "paid",
      lastPaidAt: new Date()
    };
    await customer.save();

    return ok(res, {
      customerId: customer.customerId,
      paymentStatus: "paid",
      amount,
      dueAmount: 0,
      idempotentReplay: Boolean(existingPayment)
    });
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
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    return ok(res, {
      sameSsidMode: true,
      ssid24: device?.wifiInfo?.ssid24Masked || "JustFiber",
      ssid5: device?.wifiInfo?.ssid5Masked || "JustFiber",
      connectedDevices: Array.isArray(device?.lanInfo?.connectedDevices) ? device.lanInfo.connectedDevices.length : device?.lanInfo?.leasedClients || 0,
      natEnabled: device?.wifiInfo?.natEnabled ?? true,
      pppoeUsername: device?.wanInfo?.pppoeUsernameMasked || `jfr_${String(customer.customerId).toLowerCase()}`,
      paused: Boolean(device?.wifiInfo?.paused),
      guestWifi: {
        enabled: Boolean(device?.wifiInfo?.guestWifiEnabled),
        ssid: device?.wifiInfo?.guestSsid || "JustFiber-Guest"
      }
    });
  })
);

customerPortalRouter.post(
  "/wifi/update",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = wifiUpdateSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const sameSsidMode = payload.sameSsidMode ?? true;
    const ssid24 = payload.ssid24 || device.wifiInfo?.ssid24Masked || "JustFiber";
    const ssid5 = sameSsidMode ? payload.ssid24 || ssid24 : payload.ssid5 || device.wifiInfo?.ssid5Masked || "JustFiber";
    const password24 = payload.password24 || payload.password5;
    const password5 = sameSsidMode ? payload.password24 || payload.password5 : payload.password5 || payload.password24;
    const brand = detectOntBrand({
      serialNumber: device.serialNumber,
      productClass: device.productClass,
      deviceId: device.deviceId
    });
    let syncMode = "genieacs";
    let syncWarning = null;
    try {
      await genieacsClient.pushAccessConfig({
        deviceId: device.deviceId,
        brand,
        pppoeUsername: device.wanInfo?.pppoeUsernameMasked,
        pppoePassword: undefined,
        vlanId: device.wanInfo?.vlanId,
        natEnabled: true,
        ssid24,
        ssid5,
        wifiPassword24: password24,
        wifiPassword5: password5
      });
      if (brand === "nokia" && (password24 || password5)) {
        await genieacsClient.rebootDevice(device.deviceId);
      }
    } catch (error) {
      if (!isMissingGenieDeviceError(error)) {
        throw error;
      }
      syncMode = "cache_only";
      syncWarning = "Device not present in GenieACS; updated local cache only.";
    }
    device.wifiInfo = {
      ...(device.wifiInfo || {}),
      ssid24Masked: ssid24,
      ssid5Masked: ssid5,
      natEnabled: true
    };
    await device.save();
    await CustomerNotification.create({
      customerUserId: req.customerUser._id,
      type: "wifi_updated",
      title: "Wi-Fi updated",
      body: `Wi-Fi updated for ${customer.customerId}.`
    });
    return ok(res, {
      updated: true,
      requestedPayload: payload,
      applied: { ssid24, ssid5 },
      syncMode,
      syncWarning
    });
  })
);

customerPortalRouter.post(
  "/wifi/pause",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = wifiPauseSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    device.wifiInfo = {
      ...(device.wifiInfo || {}),
      paused: payload.paused
    };
    await device.save();
    await notifyCustomerAction(
      req.customerUser._id,
      "wifi_pause_updated",
      payload.paused ? "Wi-Fi paused" : "Wi-Fi resumed",
      `Wi-Fi ${payload.paused ? "paused" : "resumed"} for ${customer.customerId}.`,
      { paused: payload.paused }
    );
    return ok(res, { updated: true, paused: payload.paused });
  })
);

customerPortalRouter.get(
  "/wifi/guest",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice(req.customerUser);
    return ok(res, {
      enabled: Boolean(device?.wifiInfo?.guestWifiEnabled),
      ssid: device?.wifiInfo?.guestSsid || "JustFiber-Guest",
      passwordMasked: device?.wifiInfo?.guestPasswordMasked || "********"
    });
  })
);

customerPortalRouter.post(
  "/wifi/guest",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = guestWifiSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const guestSsid = payload.ssid || device.wifiInfo?.guestSsid || "JustFiber-Guest";
    device.wifiInfo = {
      ...(device.wifiInfo || {}),
      guestWifiEnabled: payload.enabled,
      guestSsid,
      guestPasswordMasked: payload.password ? "********" : device.wifiInfo?.guestPasswordMasked || "********"
    };
    await device.save();
    await notifyCustomerAction(
      req.customerUser._id,
      "guest_wifi_updated",
      "Guest Wi-Fi updated",
      `Guest Wi-Fi settings updated for ${customer.customerId}.`,
      { enabled: payload.enabled, ssid: guestSsid }
    );
    return ok(res, { updated: true, enabled: payload.enabled, ssid: guestSsid });
  })
);

customerPortalRouter.get(
  "/wifi/parental-controls",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice(req.customerUser);
    return ok(res, {
      rules: device?.lanInfo?.parentalControls || []
    });
  })
);

customerPortalRouter.post(
  "/wifi/parental-controls",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = parentalControlSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const existingRules = Array.isArray(device.lanInfo?.parentalControls) ? device.lanInfo.parentalControls : [];
    const nextRules = payload.mode === "replace" ? payload.rules : [...existingRules, ...payload.rules];
    device.lanInfo = {
      ...(device.lanInfo || {}),
      parentalControls: nextRules
    };
    await device.save();
    await notifyCustomerAction(
      req.customerUser._id,
      "parental_controls_updated",
      "Parental controls updated",
      `Parental control rules updated for ${customer.customerId}.`,
      { ruleCount: nextRules.length }
    );
    return ok(res, { updated: true, rules: nextRules });
  })
);

customerPortalRouter.post(
  "/device/reboot",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    await genieacsClient.rebootDevice(device.deviceId);
    return ok(res, {
      queued: true,
      estimatedRecoverySeconds: 60,
      deviceId: device.deviceId
    });
  })
);

customerPortalRouter.get(
  "/device/connected-devices",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const connected = getConnectedDevices(device);
    return ok(res, connected);
  })
);

customerPortalRouter.post(
  "/device/access-control",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = deviceAccessSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const updated = getConnectedDevices(device).map((item) =>
      item.clientId === payload.clientId ? { ...item, blocked: payload.blocked } : item
    );
    device.lanInfo = {
      ...(device.lanInfo || {}),
      connectedDevices: updated
    };
    await device.save();
    await notifyCustomerAction(
      req.customerUser._id,
      "device_access_updated",
      payload.blocked ? "Device blocked" : "Device unblocked",
      `${payload.clientId} ${payload.blocked ? "blocked" : "unblocked"} for ${customer.customerId}.`,
      { clientId: payload.clientId, blocked: payload.blocked }
    );
    return ok(res, { updated: true, clientId: payload.clientId, blocked: payload.blocked });
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
  asyncHandler(async (req, res) => {
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const online = device.onlineStatus === "online";
    const { speedMbps, latencyMs, packetLossPercent, rxPower } = estimateNetworkMetrics({ customer, device });
    return ok(res, {
      internetStatus: online ? "reachable" : "unreachable",
      wifiStatus: online ? "stable" : "unstable",
      opticalRxPower: rxPower ?? null,
      latencyMs,
      packetLossPercent,
      estimatedSpeedMbps: speedMbps,
      recommendation: online
        ? "Internet looks stable. If speed is low, reboot router and test on 5 GHz."
        : "Device appears offline. Check power/fiber and request installer support."
    });
  })
);

customerPortalRouter.get(
  "/ott/options",
  requireCustomerAuth,
  asyncHandler(async (_req, res) => {
    const items = await AddonCatalog.find({ active: true, category: "ott" }).sort({ name: 1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/ott/subscribe",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = addonRequestSchema.parse(req.body);
    const addon = await AddonCatalog.findOne({ addonCode: payload.addonCode, active: true }).lean();
    if (!addon) {
      throw new ApiError(404, "OTT pack not found");
    }
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: req.customerUser.linkedCustomerIds?.[0],
      type: "addon_request",
      status: "completed",
      payload: {
        addonCode: addon.addonCode,
        addonName: addon.name,
        quantity: payload.quantity,
        category: "ott",
        activatedDirectly: true
      },
      timeline: [
        { event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() },
        { event: "request.completed", actorType: "system", actorId: "ott-engine", at: new Date() }
      ]
    });
    await notifyCustomerAction(
      req.customerUser._id,
      "ott_activated",
      "OTT pack activated",
      `${addon.name} activated successfully.`,
      { addonCode: addon.addonCode, quantity: payload.quantity }
    );
    return ok(res, request, { created: true });
  })
);

customerPortalRouter.get(
  "/network/speed-test",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const metrics = estimateNetworkMetrics({ customer, device });
    return ok(res, {
      startedAt: new Date(),
      downloadMbps: metrics.speedMbps,
      uploadMbps: Math.max(2, Math.round(metrics.speedMbps * 0.35)),
      latencyMs: metrics.latencyMs,
      packetLossPercent: metrics.packetLossPercent,
      status: device.onlineStatus === "online" ? "completed" : "failed"
    });
  })
);

customerPortalRouter.get(
  "/network/quality",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const metrics = estimateNetworkMetrics({ customer, device });
    return ok(res, {
      latencyMs: metrics.latencyMs,
      packetLossPercent: metrics.packetLossPercent,
      jitterMs: Math.max(1, Math.round(metrics.latencyMs * 0.18)),
      opticalRxPower: metrics.rxPower,
      quality: metrics.packetLossPercent < 1 && metrics.latencyMs < 30 ? "good" : metrics.packetLossPercent < 3 ? "warning" : "poor"
    });
  })
);

customerPortalRouter.post(
  "/plan/change/apply",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = planChangeSchema.parse(req.body);
    const customer = await getOwnedLinkedCustomer({ customerUser: req.customerUser });
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    customer.planCode = plan.planCode;
    customer.planName = plan.name;
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      speedMbps: plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
      nextPlanChangeMode: payload.effectiveMode
    };
    await customer.save();
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      type: "plan_change",
      status: "completed",
      payload: {
        planCode: plan.planCode,
        planName: plan.name,
        effectiveMode: payload.effectiveMode,
        appliedDirectly: true
      },
      timeline: [
        { event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() },
        { event: "request.completed", actorType: "system", actorId: "customer-plan-engine", at: new Date() }
      ]
    });
    await notifyCustomerAction(
      req.customerUser._id,
      "plan_changed",
      "Plan updated",
      `Plan changed to ${plan.name}.`,
      { planCode: plan.planCode, effectiveMode: payload.effectiveMode }
    );
    return ok(res, {
      updated: true,
      customerId: customer.customerId,
      planCode: plan.planCode,
      requestNumber: request.requestNumber
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
