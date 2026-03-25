import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { Customer } from "../../models/Customer.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { AdminActionRequest } from "../../models/AdminActionRequest.js";
import { adminActionsQueue } from "../../queues/adminActionsQueue.js";
import {
  assignBookingInstallerSchema,
  statusActionSchema,
  retryProvisioningSchema,
  updateCustomerSchema,
  adminPlanChangeSchema,
  updateBookingStatusSchema
} from "./schemas.js";
import { ApiError } from "../../common/ApiError.js";
import { auditFromRequest } from "../../common/audit.js";
import { allowedPresets } from "../../integrations/genieacsClient.js";
import { buildPagination } from "../../common/pagination.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { BillingNote } from "../../models/BillingNote.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { CustomerUser } from "../../models/CustomerUser.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";
import { Installer } from "../../models/Installer.js";
import { InstallerJob } from "../../models/InstallerJob.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { SubscriberService } from "../../models/SubscriberService.js";
export const customersRouter = Router();

customersRouter.use(requireAuth);

function computePlanChangePreview({ customer, currentPlan, nextPlan, effectiveMode }) {
  const currentPrice = Number(currentPlan?.monthlyPrice || customer.billingSnapshot?.lastInvoiceAmount || 0);
  const nextPrice = Number(nextPlan?.monthlyPrice || 0);
  const remainingDays = Math.max(0, Number(customer.billingSnapshot?.remainingDays || 0));
  const billMode =
    customer.billingSnapshot?.billMode ||
    (customer.customerType === "business" ? "postpaid" : "prepaid");

  if (effectiveMode === "next_cycle") {
    return {
      billMode,
      currentPrice,
      nextPrice,
      remainingDays,
      proratedCurrentCredit: 0,
      proratedNextCharge: 0,
      adjustmentAmount: 0,
      payableNow: 0,
      creditAmount: 0,
      mode: "scheduled"
    };
  }

  if (billMode === "prepaid") {
    const ratio = Math.min(1, Math.max(0, remainingDays / 30));
    const proratedCurrentCredit = Number((currentPrice * ratio).toFixed(2));
    const proratedNextCharge = Number((nextPrice * ratio).toFixed(2));
    const adjustmentAmount = Number((proratedNextCharge - proratedCurrentCredit).toFixed(2));
    return {
      billMode,
      currentPrice,
      nextPrice,
      remainingDays,
      proratedCurrentCredit,
      proratedNextCharge,
      adjustmentAmount,
      payableNow: adjustmentAmount > 0 ? adjustmentAmount : 0,
      creditAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
      mode: "immediate"
    };
  }

  const adjustmentAmount = Number((nextPrice - currentPrice).toFixed(2));
  return {
    billMode,
    currentPrice,
    nextPrice,
    remainingDays,
    proratedCurrentCredit: 0,
    proratedNextCharge: nextPrice,
    adjustmentAmount,
    payableNow: adjustmentAmount > 0 ? adjustmentAmount : 0,
    creditAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
    mode: "immediate"
  };
}

function buildBookingTracking(status, existingTracking = {}, note) {
  const stepMap = {
    initiated: "booking_placed",
    payment_pending: "payment_confirmed",
    paid: "payment_confirmed",
    awaiting_assignment: "payment_confirmed",
    assigned: "installer_assigned",
    in_progress: "work_in_progress",
    installed: "installation_completed",
    cancelled: "cancelled"
  };
  const currentStep = stepMap[status] || existingTracking.currentStep || "booking_placed";
  const existingSteps = Array.isArray(existingTracking.steps) ? [...existingTracking.steps] : [];
  const upsertStep = (code, stepStatus, atValue) => {
    const index = existingSteps.findIndex((item) => item?.code === code);
    const next = { code, status: stepStatus, at: atValue };
    if (index >= 0) {
      existingSteps[index] = { ...existingSteps[index], ...next };
    } else {
      existingSteps.push(next);
    }
  };

  upsertStep("booking_placed", "done", existingTracking?.steps?.find?.((item) => item?.code === "booking_placed")?.at || new Date());
  if (["paid", "awaiting_assignment", "assigned", "in_progress", "installed"].includes(status)) {
    upsertStep("payment_confirmed", "done", new Date());
  } else if (status === "payment_pending") {
    upsertStep("payment_confirmed", "pending", null);
  }
  if (["assigned", "in_progress", "installed"].includes(status)) {
    upsertStep("installer_assigned", "done", new Date());
  } else if (status === "awaiting_assignment") {
    upsertStep("installer_assigned", "pending", null);
  }
  if (status === "in_progress") {
    upsertStep("work_in_progress", "done", new Date());
  }
  if (status === "installed") {
    upsertStep("work_in_progress", "done", new Date());
    upsertStep("installation_completed", "done", new Date());
  }
  if (status === "cancelled") {
    upsertStep("cancelled", "done", new Date());
  }

  return {
    currentStep,
    steps: existingSteps,
    lastAdminNote: note || existingTracking.lastAdminNote || ""
  };
}

async function createPlanChangeBillingNote({ customer, type, amount, reasonCode, note, metadata, createdByAdminId }) {
  const safeAmount = Number(amount || 0);
  if (!(safeAmount > 0)) return null;
  return BillingNote.create({
    noteNumber: `${type === "credit" ? "CN" : "DN"}-${Date.now()}`,
    type,
    customerId: customer.customerId,
    serviceId: customer.serviceId,
    reasonCode,
    note,
    amount: safeAmount,
    taxAmount: 0,
    totalAmount: safeAmount,
    taxMode: "flat_tax",
    status: "applied",
    metadata,
    createdByAdminId,
    appliedAt: new Date()
  });
}

customersRouter.get(
  "/",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.search) {
      const searchValue = String(req.query.search).trim();
      const searchRegex = { $regex: searchValue, $options: "i" };
      const matchingDeviceCustomerIds = await DeviceOperationalCache.distinct("customerId", {
        $or: [
          { "wanInfo.pppoeUsernameMasked": searchRegex },
          { "wanInfo.pppoeUsername": searchRegex },
          { deviceId: searchRegex },
          { serialNumber: searchRegex }
        ]
      });
      filter.$or = [
        { customerId: searchValue },
        { accountNumber: searchValue },
        { phone: searchValue },
        { email: searchRegex },
        { fullName: searchRegex },
        ...(matchingDeviceCustomerIds.length ? [{ customerId: { $in: matchingDeviceCustomerIds } }] : [])
      ];
    }
    if (req.query.status) {
      filter.operationalStatus = req.query.status;
    }
    if (req.query.planCode) {
      filter.planCode = req.query.planCode;
    }
    if (req.query.city) {
      filter["address.city"] = req.query.city;
    }
    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

customersRouter.get(
  "/:customerId",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const linkedUsers = await CustomerUser.find({
      $or: [
        { linkedCustomerIds: customer.customerId },
        ...(customer.phone ? [{ mobile: customer.phone }] : []),
        ...(customer.email ? [{ email: customer.email }] : [])
      ]
    })
      .select({ _id: 1 })
      .lean();
    const bookingUserIds = linkedUsers.map((user) => user._id);
    const bookingFilter = {
      $or: [
        ...(bookingUserIds.length ? [{ customerUserId: { $in: bookingUserIds } }] : []),
        ...(customer.phone ? [{ "personalDetails.mobile": customer.phone }] : [])
      ]
    };
    const [devices, tickets, invoices, payments, actions, billingNotes, serviceRequests, bookings, subscriberService] = await Promise.all([
      DeviceOperationalCache.find({ customerId: customer.customerId }).lean(),
      SupportTicket.find({ customerId: customer.customerId }).sort({ createdAt: -1 }).limit(20).lean()
      ,
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1 }).limit(12).lean(),
      PaymentTransaction.find({ customerId: customer.customerId }).sort({ paidAt: -1, createdAt: -1 }).limit(12).lean(),
      AdminActionRequest.find({ targetType: "customer", targetId: customer.customerId }).sort({ createdAt: -1 }).limit(20).lean(),
      BillingNote.find({ customerId: customer.customerId }).sort({ issuedAt: -1, createdAt: -1 }).limit(12).lean(),
      ServiceRequest.find({ customerId: customer.customerId }).sort({ createdAt: -1 }).limit(20).lean(),
      bookingFilter.$or.length
        ? ConnectionBooking.find(bookingFilter).sort({ createdAt: -1 }).limit(12).lean()
        : Promise.resolve([]),
      SubscriberService.findOne({
        $or: [
          ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : []),
          { customerId: customer.customerId }
        ]
      }).lean()
    ]);
    return ok(res, {
      ...customer,
      devices,
      tickets,
      invoices,
      payments,
      actions,
      billingNotes,
      serviceRequests,
      bookings,
      radiusService: subscriberService
        ? {
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername,
            accessProfileCode: subscriberService.accessProfileCode,
            billingProfileCode: subscriberService.billingProfileCode,
            bngNodeCode: subscriberService.bngNodeCode,
            status: subscriberService.status,
            activatedAt: subscriberService.activatedAt,
            suspendedAt: subscriberService.suspendedAt,
            updatedAt: subscriberService.updatedAt
          }
        : null
    });
  })
);

customersRouter.patch(
  "/:customerId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = updateCustomerSchema.parse(req.body || {});
    const customer = await Customer.findOneAndUpdate(
      { customerId: req.params.customerId },
      { $set: payload },
      { new: true }
    ).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    await auditFromRequest(req, {
      action: "customer.updated",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: Object.keys(payload)
    });
    return ok(res, customer);
  })
);

customersRouter.patch(
  "/:customerId/bookings/:bookingId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = updateBookingStatusSchema.parse(req.body || {});
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    const linkedUsers = await CustomerUser.find({
      $or: [
        { linkedCustomerIds: customer.customerId },
        ...(customer.phone ? [{ mobile: customer.phone }] : []),
        ...(customer.email ? [{ email: customer.email }] : [])
      ]
    }).select({ _id: 1 }).lean();
    const linkedUserIds = linkedUsers.map((item) => String(item._id));

    const booking = await ConnectionBooking.findById(req.params.bookingId);
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    const belongsToCustomer =
      (booking.customerUserId && linkedUserIds.includes(String(booking.customerUserId))) ||
      (customer.phone && booking.personalDetails?.mobile === customer.phone);

    if (!belongsToCustomer) {
      throw new ApiError(404, "Booking not found for this customer");
    }

    booking.status = payload.status;
    booking.tracking = buildBookingTracking(payload.status, booking.tracking || {}, payload.note);
    if (payload.status === "paid") {
      booking.payment = {
        ...(booking.payment || {}),
        status: "paid",
        paidAt: booking.payment?.paidAt || new Date()
      };
    }
    if (payload.status === "cancelled") {
      booking.payment = {
        ...(booking.payment || {}),
        status: booking.payment?.status || "cancelled"
      };
    }

    await booking.save();
    if (booking.customerUserId) {
      await CustomerNotification.create({
        customerUserId: booking.customerUserId,
        type: "booking_updated",
        title: "Booking updated",
        body: `Booking ${booking.bookingNumber} is now ${booking.status}.`,
        payload: {
          bookingId: booking._id.toString(),
          bookingNumber: booking.bookingNumber,
          status: booking.status
        }
      });
    }
    await auditFromRequest(req, {
      action: "customer.booking.updated",
      entityType: "booking",
      entityId: booking._id.toString(),
      metadata: { status: payload.status }
    });

    return ok(res, booking);
  })
);

customersRouter.post(
  "/:customerId/bookings/:bookingId/assign-installer",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = assignBookingInstallerSchema.parse(req.body || {});
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    const linkedUsers = await CustomerUser.find({
      $or: [
        { linkedCustomerIds: customer.customerId },
        ...(customer.phone ? [{ mobile: customer.phone }] : []),
        ...(customer.email ? [{ email: customer.email }] : [])
      ]
    }).select({ _id: 1 }).lean();
    const linkedUserIds = linkedUsers.map((item) => String(item._id));

    const [booking, installer] = await Promise.all([
      ConnectionBooking.findById(req.params.bookingId),
      Installer.findById(payload.installerId)
    ]);
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }
    if (!installer) {
      throw new ApiError(404, "Installer not found");
    }

    const belongsToCustomer =
      (booking.customerUserId && linkedUserIds.includes(String(booking.customerUserId))) ||
      (customer.phone && booking.personalDetails?.mobile === customer.phone);

    if (!belongsToCustomer) {
      throw new ApiError(404, "Booking not found for this customer");
    }
    if (installer.status !== "active" || installer.availabilityStatus === "on_leave") {
      throw new ApiError(409, "Installer cannot be assigned");
    }
    if (["installed", "cancelled"].includes(booking.status)) {
      throw new ApiError(409, "Closed bookings cannot be reassigned");
    }

    const existingJobId =
      booking.assignment?.jobId ||
      booking.tracking?.steps?.find?.((item) => item?.code === "installer_assigned")?.jobId;
    let job = existingJobId ? await InstallerJob.findById(existingJobId) : null;

    const planRecord = booking.selectedPlan?.planCode
      ? await PlanCatalog.findOne({ planCode: booking.selectedPlan.planCode }).lean()
      : customer.planCode
        ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean()
        : null;

    const customerSnapshot = {
      fullName: booking.personalDetails?.fullName || customer.fullName || customer.customerId,
      phone: booking.personalDetails?.mobile || customer.phone || "",
      alternatePhone: booking.personalDetails?.alternateMobile || "",
      address: booking.personalDetails?.fullAddress || customer.address?.line1 || "",
      location: booking.feasibility?.location || booking.personalDetails?.location || undefined,
      preferredSlot: booking.personalDetails?.preferredSlot || null,
      planName: booking.selectedPlan?.planName || booking.selectedPlan?.planCode || customer.planName || "",
      planCode: booking.selectedPlan?.planCode || customer.planCode || "",
      planCategory: planRecord?.category || "home",
      monthlyPrice: Number(planRecord?.monthlyPrice || booking.selectedPlan?.monthlyPrice || 0),
      otcCharge: Number(planRecord?.otcCharge || booking.selectedPlan?.otcCharge || 0),
      installationCharge: Number(planRecord?.installationCharge || 0),
      speedMbps: Number(planRecord?.speedMbps || booking.selectedPlan?.speedMbps || 0),
      uploadSpeedMbps: Number(planRecord?.uploadSpeedMbps || booking.selectedPlan?.uploadSpeedMbps || 0),
      burstDownloadMbps: Number(planRecord?.burstDownloadMbps || booking.selectedPlan?.burstDownloadMbps || 0) || null,
      burstUploadMbps: Number(planRecord?.burstUploadMbps || booking.selectedPlan?.burstUploadMbps || 0) || null,
      dataPolicy: planRecord?.dataPolicy || booking.selectedPlan?.dataPolicy || "unlimited",
      dataLimitGb: Number(planRecord?.dataLimitGb || booking.selectedPlan?.dataLimitGb || 0) || null,
      fupSpeedMbps: Number(planRecord?.fupSpeedMbps || booking.selectedPlan?.fupSpeedMbps || 0) || null,
      fairUsageResetPolicy: planRecord?.fairUsageResetPolicy || booking.selectedPlan?.fairUsageResetPolicy || "monthly",
      latencyClass: planRecord?.latencyClass || booking.selectedPlan?.latencyClass || "standard",
      contentionRatio: planRecord?.contentionRatio || booking.selectedPlan?.contentionRatio || null,
      routerIncluded: Boolean(planRecord?.routerIncluded || booking.selectedPlan?.routerIncluded),
      routerModel: planRecord?.routerModel || booking.selectedPlan?.routerModel || "",
      routerRental: Number(planRecord?.routerRental || booking.selectedPlan?.routerRental || 0) || null,
      tags: Array.isArray(planRecord?.tags) ? planRecord.tags : [],
      staticBenefits: Array.isArray(planRecord?.staticBenefits) ? planRecord.staticBenefits : [],
      features: Array.isArray(planRecord?.features)
        ? planRecord.features.filter(Boolean)
        : typeof planRecord?.features === "string"
          ? [planRecord.features]
          : [],
      ottApps: Array.isArray(planRecord?.ottApps) ? planRecord.ottApps : [],
      planProvisioning: planRecord?.provisioning || null
    };

    if (job) {
      job.installerId = installer._id;
      job.priority = payload.priority || job.priority || "medium";
      job.status = ["completed", "cancelled"].includes(job.status) ? "assigned" : job.status;
      job.customerSnapshot = { ...(job.customerSnapshot || {}), ...customerSnapshot };
      job.assignment = {
        ...(job.assignment || {}),
        assignedAt: new Date(),
        assignedBy: req.admin._id,
        autoAssigned: false,
        zone: installer.assignedZones?.[0] || null
      };
      job.timeline.push({
        event: "job.reassigned",
        actorType: "admin",
        actorId: req.admin._id,
        note: payload.note || `Booking ${booking.bookingNumber} manually reassigned`
      });
      await job.save();
    } else {
      job = await InstallerJob.create({
        jobNumber: `JOB-${Date.now()}`,
        type: "installation",
        status: "assigned",
        customerId: booking.bookingNumber,
        serviceId: booking.bookingNumber,
        installerId: installer._id,
        priority: payload.priority,
        customerSnapshot,
        assignment: {
          assignedAt: new Date(),
          assignedBy: req.admin._id,
          autoAssigned: false,
          zone: installer.assignedZones?.[0] || null
        },
        timeline: [
          {
            event: "job.assigned",
            actorType: "admin",
            actorId: req.admin._id,
            note: payload.note || `Booking ${booking.bookingNumber} assigned from admin customer panel`
          }
        ]
      });
    }

    booking.status = "assigned";
    booking.assignment = {
      ...(booking.assignment || {}),
      installerId: installer._id,
      installerName: installer.fullName || installer.installerCode || "Installer",
      installerPhone: installer.phone || "",
      assignedAt: new Date(),
      autoAssigned: false,
      zone: installer.assignedZones?.[0] || null,
      jobId: job._id
    };
    booking.tracking = buildBookingTracking("assigned", booking.tracking || {}, payload.note);
    if (Array.isArray(booking.tracking?.steps)) {
      booking.tracking.steps = booking.tracking.steps.map((step) =>
        step?.code === "installer_assigned"
          ? { ...step, status: "done", at: new Date(), jobId: job._id }
          : step
      );
    }
    await booking.save();

    await Installer.updateOne({ _id: installer._id }, { $set: { availabilityStatus: "busy" } });
    await InstallerNotification.create({
      installerId: installer._id,
      type: "new_job",
      title: "Booking assigned from admin",
      body: `${customerSnapshot.fullName} installation has been assigned.`,
      payload: { bookingNumber: booking.bookingNumber, installerJobId: job._id }
    });
    if (booking.customerUserId) {
      await CustomerNotification.create({
        customerUserId: booking.customerUserId,
        type: "installer_assigned",
        title: "Installer assigned",
        body: `${installer.fullName || "Installer"} has been assigned for booking ${booking.bookingNumber}.`,
        payload: {
          bookingNumber: booking.bookingNumber,
          installerJobId: job._id,
          installerId: installer._id
        }
      });
    }

    await auditFromRequest(req, {
      action: "customer.booking.installer_assigned",
      entityType: "booking",
      entityId: booking._id.toString(),
      metadata: {
        bookingNumber: booking.bookingNumber,
        installerId: String(installer._id),
        installerName: installer.fullName || installer.installerCode
      }
    });

    return ok(res, booking);
  })
);

async function createActionRequest(req, res, actionType) {
  const payload = statusActionSchema.parse(req.body);
  const customer = await Customer.findOne({ customerId: req.params.customerId });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const existing = await AdminActionRequest.findOne({
    actionType,
    targetType: "customer",
    targetId: customer.customerId,
    status: { $in: ["pending", "approved"] }
  });
  if (existing) {
    throw new ApiError(409, "Similar action already in progress");
  }

  const request = await AdminActionRequest.create({
    actionType,
    targetType: "customer",
    targetId: customer.customerId,
    payload,
    requestedBy: req.admin._id,
    status: "approved"
  });

  const job = await adminActionsQueue.add(
    "customer-status-change",
    {
      actionRequestId: request._id.toString(),
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      actionType
    },
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000
      },
      jobId: `action:${request._id.toString()}`
    }
  );

  request.executionJobId = job.id;
  await request.save();

  await auditFromRequest(req, {
    action: `customer.${actionType}.requested`,
    entityType: "customer",
    entityId: customer.customerId,
    metadata: payload
  });

  return ok(res, {
    actionRequestId: request._id,
    status: request.status
  });
}

customersRouter.post(
  "/:customerId/plan-change/preview",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = adminPlanChangeSchema.parse(req.body || {});
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const currentPlan = customer.planCode ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean() : null;
    const preview = computePlanChangePreview({ customer, currentPlan, nextPlan: plan, effectiveMode: payload.effectiveMode });
    return ok(res, {
      customerId: customer.customerId,
      currentPlanCode: currentPlan?.planCode || customer.planCode,
      nextPlanCode: plan.planCode,
      nextPlanName: plan.name,
      effectiveMode: payload.effectiveMode,
      ...preview
    });
  })
);

customersRouter.post(
  "/:customerId/plan-change/apply",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = adminPlanChangeSchema.parse(req.body || {});
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const currentPlan = customer.planCode ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean() : null;
    const nextBillMode = plan.category === "business" || plan.category === "enterprise" ? "postpaid" : "prepaid";
    const preview = computePlanChangePreview({ customer, currentPlan, nextPlan: plan, effectiveMode: payload.effectiveMode });
    const actorId = req.admin?._id?.toString?.() || "admin";

    if (payload.effectiveMode === "next_cycle") {
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        pendingPlanChange: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          billMode: nextBillMode,
          customerType: nextBillMode === "postpaid" ? "business" : "home",
          currentPrice: preview.currentPrice,
          nextPrice: preview.nextPrice,
          requestedAt: new Date().toISOString(),
          requestedByAdminId: actorId
        },
        nextPlanChangeMode: payload.effectiveMode,
        adjustmentPreview: 0
      };
      await customer.save();
      const request = await ServiceRequest.create({
        requestNumber: `SR${Date.now().toString().slice(-6)}`,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        type: "plan_change",
        status: "scheduled",
        payload: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          adjustmentPreview: 0,
          requestedByAdminId: actorId,
          note: payload.note
        },
        timeline: [
          { event: "request.created", actorType: "admin", actorId, at: new Date(), note: payload.note },
          { event: "request.scheduled", actorType: "system", actorId: "admin-plan-engine", at: new Date() }
        ]
      });
      return ok(res, {
        updated: false,
        scheduled: true,
        paymentRequired: false,
        forceApplied: false,
        customerId: customer.customerId,
        planCode: plan.planCode,
        requestNumber: request.requestNumber,
        payableNow: 0
      });
    }

    if (preview.payableNow > 0 && !payload.forceApply) {
      const note = await createPlanChangeBillingNote({
        customer,
        type: "debit",
        amount: preview.payableNow,
        reasonCode: "plan_upgrade_adjustment",
        note: payload.note || `Additional amount payable for plan change to ${plan.name}`,
        metadata: {
          currentPlanCode: currentPlan?.planCode,
          nextPlanCode: plan.planCode,
          effectiveMode: payload.effectiveMode,
          requestedByAdminId: actorId
        },
        createdByAdminId: req.admin?._id
      });
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        dueAmount: Number((Number(customer.billingSnapshot?.dueAmount || 0) + preview.payableNow).toFixed(2)),
        adjustmentPreview: preview.adjustmentAmount,
        pendingPlanChange: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          billMode: nextBillMode,
          customerType: nextBillMode === "postpaid" ? "business" : "home",
          currentPrice: preview.currentPrice,
          nextPrice: preview.nextPrice,
          noteNumber: note?.noteNumber,
          requestedAt: new Date().toISOString(),
          requestedByAdminId: actorId
        }
      };
      await customer.save();
      const request = await ServiceRequest.create({
        requestNumber: `SR${Date.now().toString().slice(-6)}`,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        type: "plan_change",
        status: "pending_payment",
        payload: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          payableNow: preview.payableNow,
          noteNumber: note?.noteNumber,
          requestedByAdminId: actorId,
          note: payload.note
        },
        timeline: [
          { event: "request.created", actorType: "admin", actorId, at: new Date(), note: payload.note },
          { event: "request.payment_required", actorType: "system", actorId: "admin-plan-engine", at: new Date(), note: `Pay Rs ${preview.payableNow.toFixed(2)} to complete plan change` }
        ]
      });
      return ok(res, {
        updated: false,
        scheduled: false,
        paymentRequired: true,
        forceApplied: false,
        customerId: customer.customerId,
        planCode: plan.planCode,
        requestNumber: request.requestNumber,
        payableNow: preview.payableNow
      });
    }

    if (preview.payableNow > 0 && payload.forceApply) {
      await createPlanChangeBillingNote({
        customer,
        type: "debit",
        amount: preview.payableNow,
        reasonCode: "plan_upgrade_adjustment",
        note: payload.note || `Forced admin plan change to ${plan.name}`,
        metadata: {
          currentPlanCode: currentPlan?.planCode,
          nextPlanCode: plan.planCode,
          effectiveMode: payload.effectiveMode,
          forcedByAdminId: actorId
        },
        createdByAdminId: req.admin?._id
      });
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        dueAmount: Number((Number(customer.billingSnapshot?.dueAmount || 0) + preview.payableNow).toFixed(2)),
      };
    } else if (preview.creditAmount > 0) {
      await createPlanChangeBillingNote({
        customer,
        type: "credit",
        amount: preview.creditAmount,
        reasonCode: "plan_downgrade_adjustment",
        note: payload.note || `Credit adjustment applied for plan change to ${plan.name}`,
        metadata: {
          currentPlanCode: currentPlan?.planCode,
          nextPlanCode: plan.planCode,
          effectiveMode: payload.effectiveMode,
          requestedByAdminId: actorId
        },
        createdByAdminId: req.admin?._id
      });
    }

    customer.planCode = plan.planCode;
    customer.planName = plan.name;
    customer.customerType = nextBillMode === "postpaid" ? "business" : "home";
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      speedMbps: plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
      uploadSpeedMbps:
        plan.uploadSpeedMbps ||
        customer.billingSnapshot?.uploadSpeedMbps ||
        Math.max(2, Math.round((plan.speedMbps || customer.billingSnapshot?.speedMbps || 100) * 0.35)),
      dataPolicy: plan.dataPolicy || customer.billingSnapshot?.dataPolicy || "unlimited",
      dataLimitGb: Number(plan.dataLimitGb || customer.billingSnapshot?.dataLimitGb || 0) || null,
      fupSpeedMbps: Number(plan.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || null,
      billMode: nextBillMode,
      lastPlanPrice: Number(currentPlan?.monthlyPrice || customer.billingSnapshot?.lastInvoiceAmount || 0),
      nextPlanPrice: Number(plan.monthlyPrice || 0),
      adjustmentPreview: preview.adjustmentAmount,
      pendingPlanChange: null,
      nextPlanChangeMode: payload.effectiveMode
    };
    await customer.save();
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      type: "plan_change",
      status: "completed",
      payload: {
        planCode: plan.planCode,
        planName: plan.name,
        effectiveMode: payload.effectiveMode,
        appliedDirectly: true,
        adminForceApplied: Boolean(payload.forceApply && preview.payableNow > 0),
        requestedByAdminId: actorId,
        payableNow: preview.payableNow
      },
      timeline: [
        { event: "request.created", actorType: "admin", actorId, at: new Date(), note: payload.note },
        { event: "request.completed", actorType: "admin", actorId, at: new Date(), note: payload.forceApply ? "Force applied" : "Applied directly" }
      ]
    });
    await auditFromRequest(req, {
      action: "customer.plan_change.applied",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: {
        currentPlanCode: currentPlan?.planCode,
        nextPlanCode: plan.planCode,
        effectiveMode: payload.effectiveMode,
        forceApply: Boolean(payload.forceApply),
        payableNow: preview.payableNow,
        creditAmount: preview.creditAmount
      }
    });
    return ok(res, {
      updated: true,
      scheduled: false,
      paymentRequired: false,
      forceApplied: Boolean(payload.forceApply && preview.payableNow > 0),
      customerId: customer.customerId,
      planCode: plan.planCode,
      requestNumber: request.requestNumber,
      payableNow: preview.payableNow
    });
  })
);

customersRouter.post(
  "/:customerId/suspend",
  requirePermission(permissions.customerSuspend),
  asyncHandler(async (req, res) => createActionRequest(req, res, "suspend"))
);

customersRouter.post(
  "/:customerId/resume",
  requirePermission(permissions.customerResume),
  asyncHandler(async (req, res) => createActionRequest(req, res, "resume"))
);

customersRouter.post(
  "/:customerId/retry-provisioning",
  requirePermission(permissions.customerRetryProvisioning),
  asyncHandler(async (req, res) => {
    const payload = retryProvisioningSchema.parse(req.body);
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    if (!allowedPresets.has(payload.presetName)) {
      throw new ApiError(400, "Preset not allowed");
    }
    const request = await AdminActionRequest.create({
      actionType: "retry_provisioning",
      targetType: "customer",
      targetId: customer.customerId,
      payload,
      requestedBy: req.admin._id,
      status: "approved"
    });
    await adminActionsQueue.add(
      "retry-provisioning",
      {
        actionRequestId: request._id.toString(),
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        presetName: payload.presetName
      },
      {
        attempts: 4,
        backoff: {
          type: "exponential",
          delay: 2000
        },
        jobId: `action:${request._id.toString()}`
      }
    );
    await auditFromRequest(req, {
      action: "customer.retry_provisioning.requested",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: payload
    });
    return ok(res, { actionRequestId: request._id, status: request.status });
  })
);
