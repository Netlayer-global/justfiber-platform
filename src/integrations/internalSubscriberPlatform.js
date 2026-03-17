import { AccessProfile } from "../models/AccessProfile.js";
import { BillingInvoice } from "../models/BillingInvoice.js";
import { BillingProfile } from "../models/BillingProfile.js";
import { BngNode } from "../models/BngNode.js";
import { ConnectionBooking } from "../models/ConnectionBooking.js";
import { Customer } from "../models/Customer.js";
import { CustomerUser } from "../models/CustomerUser.js";
import { PlanCatalog } from "../models/PlanCatalog.js";
import { SubscriberService } from "../models/SubscriberService.js";
import { buildPppoeCredentials } from "../common/networkProvisioning.js";

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

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function pickAccessProfile(plan) {
  if (!plan) {
    return AccessProfile.findOne({ active: true }).sort({ downMbps: 1, createdAt: 1 }).lean();
  }
  return (
    (await AccessProfile.findOne({
      active: true,
      downMbps: Number(plan.speedMbps || 0)
    }).lean()) ||
    AccessProfile.findOne({ active: true }).sort({ downMbps: 1, createdAt: 1 }).lean()
  );
}

async function pickBillingProfile() {
  return BillingProfile.findOne({ active: true }).sort({ createdAt: 1 }).lean();
}

async function pickBngNode() {
  return BngNode.findOne({ status: "active" }).sort({ createdAt: 1 }).lean();
}

function buildBillCycle(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
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

    const identifiers = booking.assignment?.provisionedIds || buildIdentifiers(booking.bookingNumber);
    const plan =
      (booking.selectedPlan?.planCode && (await PlanCatalog.findOne({ planCode: booking.selectedPlan.planCode }).lean())) ||
      (await PlanCatalog.findOne({ name: booking.selectedPlan?.planName }).lean());
    const [accessProfile, billingProfile, bngNode] = await Promise.all([
      pickAccessProfile(plan),
      pickBillingProfile(),
      pickBngNode()
    ]);
    const provisionalPppoe = jobRecord.activation?.preparedCredentials?.pppoe || buildPppoeCredentials(identifiers.customerId);

    const customer = await Customer.findOneAndUpdate(
      { customerId: identifiers.customerId },
      {
        $set: {
          accountNumber: identifiers.accountNumber,
          fullName: booking.personalDetails?.fullName || jobRecord.customerSnapshot?.fullName || "JustFiber Customer",
          phone: booking.personalDetails?.mobile || jobRecord.customerSnapshot?.phone,
          email: booking.personalDetails?.email,
          serviceId: identifiers.serviceId,
          planCode: plan?.planCode || booking.selectedPlan?.planCode,
          planName: plan?.name || booking.selectedPlan?.planName,
          jazeStatus: "internal_platform",
          operationalStatus: "activation_in_progress",
          expiryAt: addDays(new Date(), 30),
          address: {
            ...(booking.personalDetails?.fullAddress ? { fullAddress: booking.personalDetails.fullAddress } : {}),
            ...(booking.personalDetails?.pinCode ? { pinCode: booking.personalDetails.pinCode } : {})
          },
          lastSyncedAt: new Date()
        },
        $setOnInsert: {
          billingSnapshot: {
            lastInvoiceAmount: Number(plan?.monthlyPrice || booking.selectedPlan?.monthlyPrice || 0),
            currency: "INR",
            lastPaymentStatus: booking.payment?.status === "paid" ? "paid" : "pending",
            dueAmount: booking.payment?.status === "paid" ? 0 : Number(plan?.monthlyPrice || booking.selectedPlan?.monthlyPrice || 0),
            remainingDays: 30
          },
          invoiceSummary: {
            billCycle: "Monthly",
            billMode: "Prepaid"
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
          status: "pending_installation",
          notes: "Provisioned by internal platform from booking",
          metadata: {
            bookingNumber: booking.bookingNumber,
            planCode: plan?.planCode || booking.selectedPlan?.planCode,
            installerJobId: jobRecord._id.toString()
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

    const existingInvoice = await BillingInvoice.findOne({
      customerId: identifiers.customerId,
      billCycle: buildBillCycle()
    }).lean();
    if (!existingInvoice) {
      await BillingInvoice.create(buildInvoicePayload({ customer, plan, booking, serviceId: identifiers.serviceId }));
    }

    return {
      booking,
      customer,
      subscriberService: await SubscriberService.findOne({ serviceId: identifiers.serviceId }).lean(),
      accessProfile,
      billingProfile,
      bngNode
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
    const identifiers = booking?.assignment?.provisionedIds || buildIdentifiers(installerJob.customerId);

    const customer = await Customer.findOneAndUpdate(
      { customerId: identifiers.customerId },
      {
        $set: {
          serviceId: identifiers.serviceId,
          accountNumber: identifiers.accountNumber,
          operationalStatus: "active",
          jazeStatus: "internal_platform",
          expiryAt: addDays(new Date(), 30),
          billingSnapshot: {
            lastInvoiceAmount: installerJob.customerSnapshot?.monthlyPrice || installerJob.customerSnapshot?.totalAmount || 0,
            currency: "INR",
            lastPaymentStatus: booking?.payment?.status === "paid" ? "paid" : "pending",
            dueAmount: booking?.payment?.status === "paid" ? 0 : installerJob.customerSnapshot?.monthlyPrice || 0,
            remainingDays: 30,
            speedMbps: installerJob.customerSnapshot?.speedMbps,
            lastPaymentProvider: booking?.payment?.provider || "internal_platform"
          },
          invoiceSummary: {
            billCycle: "Monthly",
            billMode: "Prepaid"
          },
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
          metadata: {
            bookingNumber: booking?.bookingNumber,
            wifi,
            pppoe,
            deviceId,
            vlanId
          }
        }
      }
    );

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
}

export const internalSubscriberPlatform = new InternalSubscriberPlatform();
