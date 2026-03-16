import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { NetworkNodeStatus } from "../../models/NetworkNodeStatus.js";
import { Customer } from "../../models/Customer.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { jazeClient } from "../../integrations/jazeClient.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";
import { detectOntBrand } from "../../common/networkProvisioning.js";

export const adminOpsRouter = Router();

adminOpsRouter.use(requireAuth);

adminOpsRouter.get(
  "/billing/overview",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const [totalInvoices, overdueInvoices, paidTransactions, dueAmount, collectedAmount] = await Promise.all([
      BillingInvoice.countDocuments(),
      BillingInvoice.countDocuments({ paymentStatus: "overdue" }),
      PaymentTransaction.countDocuments({ status: "success" }),
      BillingInvoice.aggregate([
        { $match: { paymentStatus: { $in: ["pending", "overdue"] } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      PaymentTransaction.aggregate([
        { $match: { status: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    return ok(res, {
      totalInvoices,
      overdueInvoices,
      paidTransactions,
      dueAmount: dueAmount[0]?.total || 0,
      collectedAmount: collectedAmount[0]?.total || 0
    });
  })
);

adminOpsRouter.get(
  "/billing/invoices",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    const [items, total] = await Promise.all([
      BillingInvoice.find(filter).sort({ generatedAt: -1 }).skip(skip).limit(limit).lean(),
      BillingInvoice.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.get(
  "/billing/payments",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    const [items, total] = await Promise.all([
      PaymentTransaction.find(filter).sort({ paidAt: -1 }).skip(skip).limit(limit).lean(),
      PaymentTransaction.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.get(
  "/network/overview",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (_req, res) => {
    const [bngsUp, bngsDown, oltsUp, totalNodes, devicesOnline, devicesOffline] = await Promise.all([
      NetworkNodeStatus.countDocuments({ nodeType: "bng", status: "up" }),
      NetworkNodeStatus.countDocuments({ nodeType: "bng", status: "down" }),
      NetworkNodeStatus.countDocuments({ nodeType: "olt", status: "up" }),
      NetworkNodeStatus.countDocuments(),
      DeviceOperationalCache.countDocuments({ onlineStatus: "online" }),
      DeviceOperationalCache.countDocuments({ onlineStatus: "offline" })
    ]);
    return ok(res, {
      bngsUp,
      bngsDown,
      oltsUp,
      totalNodes,
      devicesOnline,
      devicesOffline
    });
  })
);

adminOpsRouter.get(
  "/network/nodes",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.nodeType) {
      filter.nodeType = req.query.nodeType;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const [items, total] = await Promise.all([
      NetworkNodeStatus.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      NetworkNodeStatus.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.get(
  "/network/bng-status",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (_req, res) => {
    const items = await NetworkNodeStatus.find({ nodeType: "bng" }).sort({ updatedAt: -1 }).lean();
    return ok(res, items);
  })
);

adminOpsRouter.get(
  "/network/device-management/:deviceId",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId }).lean();
    if (!device) {
      return ok(res, null);
    }
    return ok(res, {
      deviceId: device.deviceId,
      wifi: device.wifiInfo || {},
      wan: device.wanInfo || {},
      lan: device.lanInfo || {},
      optical: device.opticalInfo || {},
      tags: device.tags || []
    });
  })
);

adminOpsRouter.get(
  "/customers/:customerId/billing",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      return ok(res, null);
    }
    const [invoices, payments] = await Promise.all([
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1 }).limit(12).lean(),
      PaymentTransaction.find({ customerId: customer.customerId }).sort({ paidAt: -1 }).limit(12).lean()
    ]);
    return ok(res, {
      summary: customer.billingSnapshot || {},
      invoices,
      payments
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/billing/payment/link-jaze",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const jazeUserId = String(req.body?.jazeUserId || customer.customerId);
    const gatewayPayload = await jazeClient.getPaymentLink({ userId: jazeUserId });
    const rawUrl =
      gatewayPayload?.paymentUrl ||
      gatewayPayload?.paymentLink ||
      gatewayPayload?.payment_link ||
      gatewayPayload?.url ||
      gatewayPayload?.redirectUrl ||
      gatewayPayload?.data?.paymentUrl ||
      gatewayPayload?.data?.payment_link;
    const paymentUrl = rawUrl ? (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${String(rawUrl).replace(/^\/+/, "")}`) : null;
    return ok(res, {
      customerId: customer.customerId,
      userId: jazeUserId,
      amount: customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0,
      paymentUrl,
      raw: gatewayPayload
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/billing/payment/confirm",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    const transactionId = req.body?.paymentId || `JAZE-ADMIN-BILL-${customer.customerId}-${Date.now()}`;
    const existingPayment = await PaymentTransaction.findOne({ transactionId }).lean();
    if (!existingPayment) {
      await PaymentTransaction.create({
        transactionId,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        provider: "jaze",
        amount: Number(req.body?.amount || customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0),
        status: "success",
        paidAt: new Date(),
        method: "onlinePayment",
        reference: req.body?.reference || req.body?.paymentId,
        metadata: {
          source: "admin_billing_confirm",
          actorAdminId: req.admin?._id?.toString()
        }
      });
    }

    const amount = Number(req.body?.amount || customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0);
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

adminOpsRouter.patch(
  "/network/device-management/:deviceId/wifi",
  requirePermission(permissions.deviceApplyPreset),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      throw new ApiError(404, "Device not found");
    }
    const ssid24 = req.body?.ssid24 || device.wifiInfo?.ssid24Masked || "JustFiber";
    const ssid5 = req.body?.ssid5 || device.wifiInfo?.ssid5Masked || "JustFiber";
    const wifiPassword = req.body?.password;
    const brand = detectOntBrand({
      serialNumber: device.serialNumber,
      productClass: device.productClass,
      deviceId: device.deviceId
    });
    await genieacsClient.pushAccessConfig({
      deviceId: device.deviceId,
      brand,
      pppoeUsername: device.wanInfo?.pppoeUsernameMasked,
      vlanId: device.wanInfo?.vlanId,
      natEnabled: true,
      ssid24,
      ssid5,
      wifiPassword
    });
    device.wifiInfo = {
      ...(device.wifiInfo || {}),
      ssid24Masked: ssid24,
      ssid5Masked: ssid5,
      natEnabled: true
    };
    await device.save();
    return ok(res, { deviceId: device.deviceId, ssid24, ssid5, updated: true });
  })
);

adminOpsRouter.post(
  "/network/device-management/:deviceId/reboot",
  requirePermission(permissions.deviceApplyPreset),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      throw new ApiError(404, "Device not found");
    }
    await genieacsClient.rebootDevice(device.deviceId);
    return ok(res, { queued: true, deviceId: device.deviceId, estimatedRecoverySeconds: 60 });
  })
);
