import { AccessProfile } from "../models/AccessProfile.js";
import { BillingInvoice } from "../models/BillingInvoice.js";
import { BillingProfile } from "../models/BillingProfile.js";
import { BngNode } from "../models/BngNode.js";
import { ConnectionBooking } from "../models/ConnectionBooking.js";
import { Customer } from "../models/Customer.js";
import { CustomerUser } from "../models/CustomerUser.js";
import { PlanCatalog } from "../models/PlanCatalog.js";
import { PaymentTransaction } from "../models/PaymentTransaction.js";
import { SystemConfig } from "../models/SystemConfig.js";
import { SubscriberService } from "../models/SubscriberService.js";
import { buildPppoeCredentials } from "../common/networkProvisioning.js";
import { reconcilePaymentToInvoice, syncCustomerBillingState } from "../common/billingAccounting.js";
import { internalBillingEngine } from "./internalBillingEngine.js";

function deriveNumericSuffix(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return (digits || `${Date.now()}`).slice(-6).padStart(6, "0");
}

function buildIdentifiers(bookingNumber) {
  const suffix = deriveNumericSuffix(bookingNumber);
  return {
    customerId: `CUST-${suffix}`,
    accountNumber: `AC-${suffix}`,
    serviceId: `SVC-${suffix}`
  };
}

async function getCustomerCafSettings() {
  const [prefixConfig, templateConfig] = await Promise.all([
    SystemConfig.findOne({ key: "settings.prefix_settings" }).lean(),
    SystemConfig.findOne({ key: "settings.additional_fields" }).lean()
  ]);

  const prefixValue = prefixConfig?.value?.caf?.prefix || "CAF-";
  const templates = Array.isArray(templateConfig?.value?.cafTemplates) ? templateConfig.value.cafTemplates : [];
  const selectedTemplate = templates[0] || {};

  return {
    prefix: String(prefixValue || "CAF-").trim() || "CAF-",
    templateKey: selectedTemplate.key || "default_caf",
    templateName: selectedTemplate.templateName || "Standard CAF"
  };
}

function buildCustomerCafNumber(prefix, customerId) {
  const cleanPrefix = String(prefix || "CAF-").trim() || "CAF-";
  return `${cleanPrefix}${String(customerId || "").replace(/^CAF[-/]?/i, "")}`;
}

function buildCustomerCafDocument(existingCustomer = {}, customerId = "", cafSettings = {}) {
  const existing = existingCustomer?.cafDocument || {};
  return {
    cafNumber: existing.cafNumber || buildCustomerCafNumber(cafSettings.prefix, customerId),
    generatedAt: existing.generatedAt || new Date(),
    templateKey: existing.templateKey || cafSettings.templateKey || "default_caf",
    templateName: existing.templateName || cafSettings.templateName || "Standard CAF"
  };
}

function resolveExistingIdentifiers(installerJob, booking = null) {
  if (booking?.assignment?.provisionedIds?.customerId && booking?.assignment?.provisionedIds?.serviceId) {
    return booking.assignment.provisionedIds;
  }

  const existingCustomerId =
    installerJob?.customerSnapshot?.customerId ||
    installerJob?.customerId ||
    null;
  const existingServiceId =
    installerJob?.customerSnapshot?.serviceId ||
    installerJob?.serviceId ||
    null;
  const existingAccountNumber =
    installerJob?.customerSnapshot?.accountNumber ||
    null;

  if (existingCustomerId && existingServiceId) {
    return {
      customerId: existingCustomerId,
      accountNumber: existingAccountNumber || `AC-${deriveNumericSuffix(existingCustomerId)}`,
      serviceId: existingServiceId
    };
  }

  return buildIdentifiers(booking?.bookingNumber || installerJob?.customerId || installerJob?.serviceId);
}

function normalizePlanNetworkProfile(plan = {}, accessProfile = null) {
  const speedMbps = Number(plan?.speedMbps || accessProfile?.downMbps || 0) || 0;
  const uploadSpeedMbps =
    Number(plan?.uploadSpeedMbps || accessProfile?.upMbps || 0) ||
    (speedMbps ? Math.max(2, Math.round(speedMbps * 0.35)) : 0);
  const burstDownloadMbps = Number(plan?.burstDownloadMbps || accessProfile?.burstDownMbps || 0) || null;
  const burstUploadMbps = Number(plan?.burstUploadMbps || accessProfile?.burstUpMbps || 0) || null;
  const dataPolicy = ["unlimited", "fup", "hard_cap"].includes(plan?.dataPolicy)
    ? plan.dataPolicy
    : "unlimited";
  const dataLimitGb = Number(plan?.dataLimitGb || 0) || null;
  const fupSpeedMbps = Number(plan?.fupSpeedMbps || 0) || null;
  const fairUsageResetPolicy = plan?.fairUsageResetPolicy || "monthly";
  const latencyClass = plan?.latencyClass || "standard";
  const contentionRatio = String(plan?.contentionRatio || "").trim() || null;
  return {
    speedMbps,
    uploadSpeedMbps,
    burstDownloadMbps,
    burstUploadMbps,
    dataPolicy,
    dataLimitGb,
    fupSpeedMbps,
    fairUsageResetPolicy,
    latencyClass,
    contentionRatio
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Math.max(1, Number(months || 1)));
  return next;
}

function resolveDurationMonths(source = {}) {
  return Math.max(1, Number(source?.durationMonths || 1));
}

function resolveBillingCycleLabel(durationMonths) {
  if (durationMonths >= 12) return "Yearly";
  if (durationMonths >= 6) return "Half-yearly";
  if (durationMonths >= 3) return "Quarterly";
  return "Monthly";
}

function resolveRecurringAmount(source = {}) {
  const durationMonths = resolveDurationMonths(source);
  const recurringAmount = Number(source?.recurringAmount || 0);
  const yearlyPrice = Number(source?.yearlyPrice || 0);
  const halfYearlyPrice = Number(source?.halfYearlyPrice || 0);
  const quarterlyPrice = Number(source?.quarterlyPrice || 0);
  const monthlyPrice = Number(source?.monthlyPrice || 0);
  if (durationMonths >= 12) return yearlyPrice || recurringAmount || monthlyPrice * 12 || 0;
  if (durationMonths >= 6) return halfYearlyPrice || recurringAmount || monthlyPrice * 6 || 0;
  if (durationMonths >= 3) return quarterlyPrice || recurringAmount || monthlyPrice * 3 || 0;
  return monthlyPrice || recurringAmount || 0;
}

function normalizeBillingBreakup(plan = {}) {
  const breakup = plan?.billingBreakup || {};
  return {
    internetLabel: breakup.internetLabel || "Internet service charge",
    platformLabel: breakup.platformLabel || "Platform fee",
    monthlyPlatformFee: Number(breakup.monthlyPlatformFee || 0),
    quarterlyPlatformFee: Number(breakup.quarterlyPlatformFee || 0),
    halfYearlyPlatformFee: Number(breakup.halfYearlyPlatformFee || 0),
    yearlyPlatformFee: Number(breakup.yearlyPlatformFee || 0)
  };
}

async function pickAccessProfile(plan) {
  if (!plan) {
    return AccessProfile.findOne({ active: true }).sort({ downMbps: 1, createdAt: 1 }).lean();
  }
  if (plan.provisioning?.accessProfileCode) {
    const mapped = await AccessProfile.findOne({
      active: true,
      code: plan.provisioning.accessProfileCode
    }).lean();
    if (mapped) return mapped;
  }
  return (
    (await AccessProfile.findOne({
      active: true,
      downMbps: Number(plan.speedMbps || 0),
      ...(plan?.uploadSpeedMbps ? { upMbps: Number(plan.uploadSpeedMbps) } : {})
    }).lean()) ||
    (await AccessProfile.findOne({
      active: true,
      downMbps: Number(plan.speedMbps || 0)
    }).sort({ upMbps: 1, createdAt: 1 }).lean()) ||
    AccessProfile.findOne({ active: true }).sort({ downMbps: 1, createdAt: 1 }).lean()
  );
}

async function pickBillingProfile() {
  return BillingProfile.findOne({ active: true }).sort({ createdAt: 1 }).lean();
}

function resolveCustomerType(plan) {
  const category = plan?.category || plan?.planCategory;
  return category === "business" || category === "enterprise" ? "business" : "home";
}

function resolveBillModeForPlan({ billingProfile, plan }) {
  const customerType = resolveCustomerType(plan);
  if (customerType === "business") {
    return billingProfile?.defaultBusinessBillMode || billingProfile?.billMode || "postpaid";
  }
  return billingProfile?.defaultHomeBillMode || billingProfile?.billMode || "prepaid";
}

async function pickBngNode() {
  return BngNode.findOne({ status: "active" }).sort({ createdAt: 1 }).lean();
}

function buildBillCycle(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function reconcileActivationPayment({ booking, invoice, customerId, serviceId }) {
  if (!booking || !invoice || booking.payment?.status !== "paid") return null;
  const paymentReference =
    (booking.payment?.provider === "razorpay" && booking.payment?.reference) ||
    booking.payment?.paymentId ||
    booking.payment?.reference ||
    `BOOKING-${booking.bookingNumber}-${invoice.invoiceId}`;
  const amount = Number(booking.payment?.amount || booking.selectedPlan?.totalAmount || invoice.totalAmount || 0);
  if (!paymentReference || !Number.isFinite(amount) || amount <= 0) return null;

  const payment = await PaymentTransaction.findOneAndUpdate(
    {
      $or: [
        { transactionId: paymentReference },
        { "metadata.bookingNumber": booking.bookingNumber, customerId }
      ]
    },
    {
      $set: {
        transactionId: paymentReference,
        customerId,
        serviceId,
        invoiceId: invoice.invoiceId,
        provider: booking.payment?.provider || "booking_payment",
        amount,
        currency: "INR",
        status: booking.payment?.provider === "razorpay" ? "captured" : "success",
        paidAt: booking.payment?.paidAt || new Date(),
        method: booking.payment?.method || (booking.payment?.provider === "razorpay" ? "onlinePayment" : "bookingPayment"),
        reference: booking.payment?.reference || paymentReference,
        reconciliationStatus: "pending",
        unallocatedAmount: amount,
        metadata: {
          bookingNumber: booking.bookingNumber,
          source: "booking_activation_payment",
          originalCustomerToken: booking.personalDetails?.mobile || booking.bookingNumber,
          bookingPaymentId: booking.payment?.paymentId || "",
          bookingReference: booking.payment?.reference || "",
          canonicalCustomerId: customerId,
          canonicalServiceId: serviceId
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return reconcilePaymentToInvoice({
    payment,
    invoice,
    confidenceScore: 1,
    matchReason: "Booking payment collected before installer activation",
    matchedBy: "booking_activation",
    reconciliationMode: "booking_activation_paid",
    ledgerSource: "booking_activation_payment",
    ledgerNote: "Booking payment reconciled against activation invoice",
    ledgerMetadata: {
      bookingNumber: booking.bookingNumber,
      paymentReference
    },
    invoiceMetadata: {
      activationPaymentReconciledAt: new Date(),
      activationPaymentReference: paymentReference
    }
  });
}

function buildInvoicePayload({ customer, plan, booking, serviceId }) {
  const generatedAt = new Date();
  const dueDate = addDays(generatedAt, 30);
  const totalAmount = Number(plan?.monthlyPrice || booking?.selectedPlan?.monthlyPrice || 0);
  const taxAmount = Number((totalAmount * 0.18).toFixed(2));
  const baseAmount = Number((totalAmount - taxAmount).toFixed(2));
  return {
    invoiceId: `INV-${customer.customerId}-${buildBillCycle(generatedAt)}`,
    customerId: customer.customerId,
    serviceId,
    invoiceNumber: `JF-INV-${customer.customerId}-${Date.now().toString().slice(-4)}`,
    billCycle: buildBillCycle(generatedAt),
    generatedAt,
    dueDate,
    amount: baseAmount,
    taxAmount,
    totalAmount,
    status: "generated",
    paymentStatus: booking?.payment?.status === "paid" ? "paid" : "pending",
    source: "internal_platform",
    metadata: {
      bookingNumber: booking?.bookingNumber,
      planCode: plan?.planCode || booking?.selectedPlan?.planCode
    }
  };
}

export class InternalSubscriberPlatform {
  async prepareServiceFromInstallerJob(jobRecord) {
    const booking =
      (await ConnectionBooking.findOne({ bookingNumber: jobRecord.customerId })) ||
      (await ConnectionBooking.findOne({ bookingNumber: jobRecord.serviceId }));
    if (!booking) {
      return {
        booking: null,
        customer: null,
        subscriberService: null,
        accessProfile: null,
        billingProfile: null,
        bngNode: null
      };
    }

    const identifiers = resolveExistingIdentifiers(jobRecord, booking);
    const plan =
      (booking.selectedPlan?.planCode && (await PlanCatalog.findOne({ planCode: booking.selectedPlan.planCode }).lean())) ||
      (await PlanCatalog.findOne({ name: booking.selectedPlan?.planName }).lean());
    const [accessProfile, billingProfile, bngNode, cafSettings] = await Promise.all([
      pickAccessProfile(plan),
      pickBillingProfile(),
      pickBngNode(),
      getCustomerCafSettings()
    ]);
    const customerType = resolveCustomerType(plan);
    const billMode = resolveBillModeForPlan({ billingProfile, plan });
    const networkProfile = normalizePlanNetworkProfile(plan, accessProfile);
    const durationMonths = resolveDurationMonths(booking.selectedPlan);
    const serviceExpiryAt = addMonths(new Date(), durationMonths);
    const remainingDays = Math.max(1, Math.ceil((serviceExpiryAt - Date.now()) / (1000 * 60 * 60 * 24)));
    const provisionalPppoe =
      jobRecord.activation?.preparedCredentials?.pppoe ||
      buildPppoeCredentials(identifiers.customerId, plan?.provisioning);
    const contactMobile =
      booking.personalDetails?.mobile ||
      jobRecord.customerSnapshot?.phone ||
      jobRecord.customerSnapshot?.mobile ||
      undefined;
    const existingCustomer = await Customer.findOne({ customerId: identifiers.customerId }).lean();
    const customerAddress = {
      ...(booking.personalDetails?.fullAddress
        ? { fullAddress: booking.personalDetails.fullAddress, line1: booking.personalDetails.fullAddress }
        : {}),
      ...(booking.personalDetails?.landmark ? { line2: booking.personalDetails.landmark } : {}),
      ...(booking.personalDetails?.area ? { area: booking.personalDetails.area } : {}),
      ...(booking.personalDetails?.pinCode ? { pinCode: booking.personalDetails.pinCode } : {}),
      ...(booking.personalDetails?.city ? { city: booking.personalDetails.city } : {}),
      ...(booking.personalDetails?.state ? { state: booking.personalDetails.state } : {})
    };

    const customer = await Customer.findOneAndUpdate(
      { customerId: identifiers.customerId },
      {
        $set: {
          accountNumber: identifiers.accountNumber,
          fullName: booking.personalDetails?.fullName || jobRecord.customerSnapshot?.fullName || "JustFiber Customer",
          ...(contactMobile ? { mobile: contactMobile, phone: contactMobile } : {}),
          email: booking.personalDetails?.email,
          serviceId: identifiers.serviceId,
          planCode: plan?.planCode || booking.selectedPlan?.planCode,
          planName: plan?.name || booking.selectedPlan?.planName,
          customerType,
          jazeStatus: "internal_platform",
          operationalStatus: "activation_in_progress",
          expiryAt: serviceExpiryAt,
          address: customerAddress,
          billingZoneCode: booking.feasibility?.matchedZone?.zoneCode || booking.feasibility?.matchedZone?.zoneName,
          billingZoneName: booking.feasibility?.matchedZone?.zoneName,
          billingStateCode: booking.personalDetails?.stateCode,
          billingStateName: booking.personalDetails?.state,
          cafDocument: buildCustomerCafDocument(existingCustomer || jobRecord.customerSnapshot || {}, identifiers.customerId, cafSettings),
          lastSyncedAt: new Date()
        },
        $setOnInsert: {
          billingSnapshot: {
            lastInvoiceAmount: Number(plan?.monthlyPrice || booking.selectedPlan?.monthlyPrice || 0),
            currency: "INR",
            lastPaymentStatus: booking.payment?.status === "paid" ? "paid" : "pending",
            dueAmount: booking.payment?.status === "paid" ? 0 : Number(plan?.monthlyPrice || booking.selectedPlan?.monthlyPrice || 0),
            remainingDays,
            speedMbps: networkProfile.speedMbps,
            uploadSpeedMbps: networkProfile.uploadSpeedMbps,
            dataPolicy: networkProfile.dataPolicy,
            dataLimitGb: networkProfile.dataLimitGb,
            fupSpeedMbps: networkProfile.fupSpeedMbps,
            billMode,
            billingZoneCode: booking.feasibility?.matchedZone?.zoneCode || booking.feasibility?.matchedZone?.zoneName,
            billingZoneName: booking.feasibility?.matchedZone?.zoneName,
            billingStateCode: booking.personalDetails?.stateCode,
            billingStateName: booking.personalDetails?.state
          },
          invoiceSummary: {
            billCycle: resolveBillingCycleLabel(durationMonths),
            billMode: billMode === "postpaid" ? "Postpaid" : "Prepaid"
          }
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await SubscriberService.findOneAndUpdate(
      { serviceId: identifiers.serviceId },
      {
        $set: {
          customerId: identifiers.customerId,
          accountNumber: identifiers.accountNumber,
          radiusUsername: provisionalPppoe.username,
          radiusPasswordMasked: "********",
          authType: "pppoe",
          accessProfileCode: accessProfile?.code,
          billingProfileCode: billingProfile?.code,
          bngNodeCode: bngNode?.nodeCode,
          billingPeriodMonths: durationMonths,
          nextBillingDate: serviceExpiryAt,
          status: "pending_installation",
          notes: "Provisioned by internal platform from booking",
          metadata: {
            bookingNumber: booking.bookingNumber,
            planCode: plan?.planCode || booking.selectedPlan?.planCode,
            customerType,
            billMode,
            installerJobId: jobRecord._id.toString(),
            durationMonths,
            nextBillingDate: serviceExpiryAt,
            networkProfile,
            monthlyPrice: Number(plan?.monthlyPrice || booking.selectedPlan?.monthlyPrice || 0),
            quarterlyPrice: Number(plan?.quarterlyPrice || booking.selectedPlan?.quarterlyPrice || 0),
            halfYearlyPrice: Number(plan?.halfYearlyPrice || booking.selectedPlan?.halfYearlyPrice || 0),
            yearlyPrice: Number(plan?.yearlyPrice || booking.selectedPlan?.yearlyPrice || 0),
            recurringAmount: resolveRecurringAmount(plan || booking.selectedPlan || {}),
            billingBreakup: normalizeBillingBreakup(plan || booking.selectedPlan || {}),
            routerModel: plan?.routerModel || booking.selectedPlan?.routerModel || "",
            routerRental: Number(plan?.routerRental || booking.selectedPlan?.routerRental || 0) || 0
          }
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await CustomerUser.updateOne(
      { _id: booking.customerUserId },
      {
        $addToSet: { linkedCustomerIds: identifiers.customerId },
        $set: {
          fullName: booking.personalDetails?.fullName || undefined,
          state: booking.payment?.status === "paid" ? "active_customer" : "booking_in_progress"
        }
      }
    );

    if (!booking.assignment?.provisionedIds) {
      booking.assignment = {
        ...(booking.assignment || {}),
        provisionedIds: identifiers
      };
      await booking.save();
    }

    return {
      booking,
      customer,
      subscriberService: await SubscriberService.findOne({ serviceId: identifiers.serviceId }).lean(),
      accessProfile,
      billingProfile,
      bngNode,
      plan
    };
  }

  async finalizeActivation({
    installerJob,
    pppoe,
    wifi,
    deviceId,
    serialNumber,
    vlanId
  }) {
    const booking =
      (await ConnectionBooking.findOne({ bookingNumber: installerJob.customerId })) ||
      (await ConnectionBooking.findOne({ bookingNumber: installerJob.activation?.bookingNumber }));
    const identifiers = resolveExistingIdentifiers(installerJob, booking);
    const subscriberService = await SubscriberService.findOne({ serviceId: identifiers.serviceId });
    const billingProfile = subscriberService?.billingProfileCode
      ? await BillingProfile.findOne({ code: subscriberService.billingProfileCode, active: true }).lean()
      : await pickBillingProfile();
    const snapshotCategory =
      installerJob.customerSnapshot?.planCategory ||
      installerJob.customerSnapshot?.category ||
      booking?.selectedPlan?.planCategory ||
      booking?.selectedPlan?.category;
    const customerType = resolveCustomerType({ category: snapshotCategory });
    const billMode = resolveBillModeForPlan({ billingProfile, plan: { category: snapshotCategory } });
    const networkProfile = normalizePlanNetworkProfile(installerJob.customerSnapshot);
    const durationMonths = resolveDurationMonths(installerJob.customerSnapshot);
    const serviceExpiryAt = addMonths(new Date(), durationMonths);
    const remainingDays = Math.max(1, Math.ceil((serviceExpiryAt - Date.now()) / (1000 * 60 * 60 * 24)));
    const billingAmount =
      Number(installerJob.customerSnapshot?.recurringAmount || 0) ||
      Number(installerJob.customerSnapshot?.monthlyPrice || 0) ||
      Number(installerJob.customerSnapshot?.totalAmount || 0) ||
      0;
    const contactMobile =
      booking?.personalDetails?.mobile ||
      installerJob.customerSnapshot?.phone ||
      installerJob.customerSnapshot?.mobile ||
      undefined;

    const customer = await Customer.findOneAndUpdate(
      { customerId: identifiers.customerId },
      {
        $set: {
          ...(contactMobile ? { mobile: contactMobile, phone: contactMobile } : {}),
          serviceId: identifiers.serviceId,
          accountNumber: identifiers.accountNumber,
          operationalStatus: "active",
          jazeStatus: "internal_platform",
          expiryAt: serviceExpiryAt,
          customerType,
          billingSnapshot: {
            lastInvoiceAmount: billingAmount,
            currency: "INR",
            lastPaymentStatus: booking?.payment?.status === "paid" ? "paid" : "pending",
            dueAmount: booking?.payment?.status === "paid" ? 0 : billingAmount,
            remainingDays,
            speedMbps: networkProfile.speedMbps,
            uploadSpeedMbps: networkProfile.uploadSpeedMbps,
            dataPolicy: networkProfile.dataPolicy,
            dataLimitGb: networkProfile.dataLimitGb,
            fupSpeedMbps: networkProfile.fupSpeedMbps,
            lastPaymentProvider: booking?.payment?.provider || "internal_platform",
            billMode,
            billingZoneCode: booking?.feasibility?.matchedZone?.zoneCode || booking?.feasibility?.matchedZone?.zoneName,
            billingZoneName: booking?.feasibility?.matchedZone?.zoneName,
            billingStateCode: booking?.personalDetails?.stateCode,
            billingStateName: booking?.personalDetails?.state
          },
          invoiceSummary: {
            billCycle: resolveBillingCycleLabel(durationMonths),
            billMode: billMode === "postpaid" ? "Postpaid" : "Prepaid"
          },
          billingZoneCode: booking?.feasibility?.matchedZone?.zoneCode || booking?.feasibility?.matchedZone?.zoneName,
          billingZoneName: booking?.feasibility?.matchedZone?.zoneName,
          billingStateCode: booking?.personalDetails?.stateCode,
          billingStateName: booking?.personalDetails?.state,
          lastSyncedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    await SubscriberService.updateOne(
      { serviceId: identifiers.serviceId },
      {
        $set: {
          customerId: identifiers.customerId,
          accountNumber: identifiers.accountNumber,
          radiusUsername: pppoe.username,
          radiusPasswordMasked: "********",
          currentIpv4: null,
          ontSerialNumber: serialNumber,
          status: "active",
          activatedAt: new Date(),
          billingPeriodMonths: durationMonths,
          nextBillingDate: serviceExpiryAt,
          metadata: {
            bookingNumber: booking?.bookingNumber,
            wifi,
            pppoe,
            deviceId,
            vlanId,
            customerType,
            billMode,
            durationMonths,
            nextBillingDate: serviceExpiryAt,
            networkProfile,
            monthlyPrice: Number(booking?.selectedPlan?.monthlyPrice || installerJob.customerSnapshot?.monthlyPrice || 0),
            quarterlyPrice: Number(booking?.selectedPlan?.quarterlyPrice || installerJob.customerSnapshot?.quarterlyPrice || 0),
            halfYearlyPrice: Number(booking?.selectedPlan?.halfYearlyPrice || installerJob.customerSnapshot?.halfYearlyPrice || 0),
            yearlyPrice: Number(booking?.selectedPlan?.yearlyPrice || installerJob.customerSnapshot?.yearlyPrice || 0),
            recurringAmount: resolveRecurringAmount(booking?.selectedPlan || installerJob.customerSnapshot || {}),
            billingBreakup: normalizeBillingBreakup(booking?.selectedPlan || installerJob.customerSnapshot || {}),
            routerModel: booking?.selectedPlan?.routerModel || installerJob.customerSnapshot?.routerModel || "",
            routerRental: Number(booking?.selectedPlan?.routerRental || installerJob.customerSnapshot?.routerRental || 0) || 0
          }
        }
      }
    );

    if (
      subscriberService &&
      billMode === "prepaid" &&
      ((billingProfile?.activationInvoiceTiming || "before_payment") === "before_payment" || booking?.payment?.status === "paid")
    ) {
      await internalBillingEngine.generateInvoiceForService(
        subscriberService.toObject ? subscriberService.toObject() : subscriberService,
        {
          billCycle: buildBillCycle(),
          billCycleLabel: resolveBillingCycleLabel(durationMonths),
          durationMonths,
          dueDate: serviceExpiryAt,
          totalAmount: billingAmount,
          paymentStatus: booking?.payment?.status === "paid" ? "paid" : "pending",
          sourceEvent: "activation"
        }
      );
      if (booking?.payment?.status === "paid") {
        await reconcileActivationPayment({
          booking,
          invoice: await BillingInvoice.findOne({ customerId: identifiers.customerId, billCycle: buildBillCycle() }),
          customerId: identifiers.customerId,
          serviceId: identifiers.serviceId
        });
      }
    }

    if (booking) {
      booking.status = "installed";
      booking.payment = {
        ...(booking.payment || {}),
        status: booking.payment?.status || "paid"
      };
      booking.tracking = {
        currentStep: "service_live",
        steps: [
          { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
          { code: "payment_confirmed", status: "done", at: booking.payment?.paidAt || booking.updatedAt || new Date() },
          { code: "installer_assigned", status: "done", at: booking.assignment?.assignedAt || booking.updatedAt || new Date() },
          { code: "service_live", status: "done", at: new Date() }
        ]
      };
      await booking.save();
      await CustomerUser.updateOne(
        { _id: booking.customerUserId },
        {
          $addToSet: { linkedCustomerIds: identifiers.customerId },
          $set: { state: "active_customer" }
        }
      );
    }

    installerJob.customerId = identifiers.customerId;
    installerJob.serviceId = identifiers.serviceId;
    installerJob.customerSnapshot = {
      ...(installerJob.customerSnapshot || {}),
      customerId: identifiers.customerId,
      accountNumber: identifiers.accountNumber,
      serviceId: identifiers.serviceId
    };
    installerJob.activation = {
      ...(installerJob.activation || {}),
      bookingNumber: booking?.bookingNumber || installerJob.activation?.bookingNumber,
      internalProvisioning: {
        customerId: identifiers.customerId,
        accountNumber: identifiers.accountNumber,
        serviceId: identifiers.serviceId
      }
    };

    return { customer, booking, identifiers };
  }

  async ensureInstallerCompletionInvoice(installerJob, options = {}) {
    const booking =
      (await ConnectionBooking.findOne({ bookingNumber: installerJob.customerId }).lean()) ||
      (await ConnectionBooking.findOne({ bookingNumber: installerJob.activation?.bookingNumber }).lean());
    const customerId = installerJob.customerId || booking?.assignment?.provisionedIds?.customerId;
    const serviceId = installerJob.serviceId || booking?.assignment?.provisionedIds?.serviceId;
    if (!customerId || !serviceId) {
      return { skipped: true, reason: "missing_identifiers" };
    }

    const subscriberService = await SubscriberService.findOne({ serviceId }).lean();
    if (!subscriberService) {
      return { skipped: true, reason: "missing_service", serviceId };
    }

    const snapshot = booking?.selectedPlan || installerJob.customerSnapshot || {};
    const durationMonths = resolveDurationMonths(snapshot);
    const totalAmount = Number(options.totalAmount ?? resolveRecurringAmount(snapshot));
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return { skipped: true, reason: "missing_amount", serviceId };
    }

    const generatedAt = options.generatedAt ? new Date(options.generatedAt) : installerJob.completedAt || new Date();
    const dueDate = options.dueDate
      ? new Date(options.dueDate)
      : installerJob.completedAt
        ? addMonths(installerJob.completedAt, durationMonths)
        : addMonths(new Date(), durationMonths);
    const paymentStatus = booking?.payment?.status === "paid" ? "paid" : options.paymentStatus || "pending";
    const invoiceResult = await internalBillingEngine.generateInvoiceForService(subscriberService, {
      generatedAt,
      dueDate,
      totalAmount,
      durationMonths,
      billCycle: buildBillCycle(generatedAt),
      billCycleLabel: resolveBillingCycleLabel(durationMonths),
      paymentStatus,
      source: "installer_activation",
      sourceEvent: "installer_completion",
      activationJobId: installerJob._id?.toString?.() || String(installerJob._id || "")
    });

    if (invoiceResult.skipped && invoiceResult.invoiceId && booking?.payment?.status === "paid") {
      const existingInvoice = await BillingInvoice.findOne({ invoiceId: invoiceResult.invoiceId });
      if (existingInvoice && String(existingInvoice.paymentStatus || "").toLowerCase() !== "paid") {
        await reconcileActivationPayment({
          booking,
          invoice: existingInvoice,
          customerId,
          serviceId
        });
      }
    }

    if (!invoiceResult.skipped && invoiceResult.invoice) {
      if (booking?.payment?.status === "paid") {
        await reconcileActivationPayment({
          booking,
          invoice: invoiceResult.invoice,
          customerId,
          serviceId
        });
      }
      await InstallerJob.updateOne(
        { _id: installerJob._id },
        {
          $set: {
            "activation.invoiceId": invoiceResult.invoice.invoiceId,
            "activation.invoiceNumber": invoiceResult.invoice.invoiceNumber,
            "activation.invoiceGeneratedAt": invoiceResult.invoice.generatedAt || new Date()
          }
        }
      );
    }

    return invoiceResult;
  }
}

export const internalSubscriberPlatform = new InternalSubscriberPlatform();
