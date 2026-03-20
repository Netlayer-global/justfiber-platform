import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { BillingLedgerEntry } from "../../models/BillingLedgerEntry.js";
import { IntegrationConnection } from "../../models/IntegrationConnection.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { NetworkNodeStatus } from "../../models/NetworkNodeStatus.js";
import { Customer } from "../../models/Customer.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { auditFromRequest } from "../../common/audit.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";
import { internalBillingEngine } from "../../integrations/internalBillingEngine.js";
import { detectOntBrand } from "../../common/networkProvisioning.js";

export const adminOpsRouter = Router();

adminOpsRouter.use(requireAuth);

function computeBalanceAfter({ currentBalance, direction, amount }) {
  return currentBalance + (direction === "debit" ? amount : -amount);
}

async function createLedgerEntry({
  customerId,
  serviceId,
  invoiceId,
  paymentId,
  category,
  direction,
  amount,
  reference,
  note,
  source,
  createdByAdminId,
  metadata
}) {
  const latestEntry = await BillingLedgerEntry.findOne({ customerId }).sort({ postedAt: -1, createdAt: -1 }).lean();
  const currentBalance = latestEntry?.balanceAfter || 0;
  const balanceAfter = computeBalanceAfter({ currentBalance, direction, amount });
  return BillingLedgerEntry.create({
    entryId: `BL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    customerId,
    serviceId,
    invoiceId,
    paymentId,
    category,
    direction,
    amount,
    balanceAfter,
    reference,
    note,
    source,
    createdByAdminId,
    metadata
  });
}

async function settleLatestPendingInvoice({ customerId, serviceId, paymentId, amount, source }) {
  const invoice = await BillingInvoice.findOne({
    customerId,
    paymentStatus: { $in: ["pending", "overdue"] }
  }).sort({ dueDate: 1, generatedAt: 1 });
  if (!invoice) {
    return null;
  }
  invoice.paymentStatus = "paid";
  invoice.status = "settled";
  invoice.metadata = {
    ...(invoice.metadata || {}),
    lastPaymentId: paymentId,
    lastPaymentSource: source,
    lastPaymentAmount: amount,
    settledBy: "admin_ops",
    settledAt: new Date()
  };
  if (!invoice.serviceId && serviceId) {
    invoice.serviceId = serviceId;
  }
  await invoice.save();
  return invoice;
}

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
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.provider) {
      filter.provider = req.query.provider;
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
    const [invoices, payments, ledger] = await Promise.all([
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1 }).limit(12).lean(),
      PaymentTransaction.find({ customerId: customer.customerId }).sort({ paidAt: -1 }).limit(12).lean(),
      BillingLedgerEntry.find({ customerId: customer.customerId }).sort({ postedAt: -1, createdAt: -1 }).limit(25).lean()
    ]);
    return ok(res, {
      summary: customer.billingSnapshot || {},
      invoices,
      payments,
      ledger
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/billing/payment/link",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    return ok(res, {
      customerId: customer.customerId,
      provider: "manual_admin",
      amount: customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0,
      paymentUrl: null,
      nextAction: "Use /customers/:customerId/billing/payment/confirm to post a manual or externally collected payment."
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
    return ok(res, {
      customerId: customer.customerId,
      provider: "manual_admin",
      amount: customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0,
      paymentUrl: null,
      nextAction: "Use /customers/:customerId/billing/payment/confirm to post a manual or externally collected payment.",
      deprecatedRoute: true
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

    const transactionId = req.body?.paymentId || `BILL-ADMIN-${customer.customerId}-${Date.now()}`;
    const existingPayment = await PaymentTransaction.findOne({ transactionId }).lean();
    let createdLedgerEntry = null;
    let settledInvoice = null;
    const amount = Number(req.body?.amount || customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0);
    if (!existingPayment) {
      await PaymentTransaction.create({
        transactionId,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        provider: "internal_platform",
        amount,
        status: "success",
        paidAt: new Date(),
        method: req.body?.method || "manualCollection",
        reference: req.body?.reference || req.body?.paymentId,
        metadata: {
          source: "admin_billing_confirm",
          actorAdminId: req.admin?._id?.toString(),
          collectionMode: req.body?.collectionMode || "admin_confirmed"
        }
      });
      settledInvoice = await settleLatestPendingInvoice({
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        paymentId: transactionId,
        amount,
        source: "admin_billing_confirm"
      });
      createdLedgerEntry = await createLedgerEntry({
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        invoiceId: settledInvoice?.invoiceId,
        paymentId: transactionId,
        category: "payment",
        direction: "credit",
        amount,
        reference: req.body?.reference || req.body?.paymentId,
        note: "Admin confirmed customer payment",
        source: "admin_billing_confirm",
        createdByAdminId: req.admin?._id,
        metadata: { requestId: req.requestId }
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
      idempotentReplay: Boolean(existingPayment),
      ledgerEntryId: createdLedgerEntry?.entryId,
      invoiceId: settledInvoice?.invoiceId || null
    });
  })
);

adminOpsRouter.patch(
  "/network/device-management/:deviceId/wifi",
  requirePermission(permissions.deviceApplyPreset),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId });
    const targetDeviceId = device?.deviceId || req.params.deviceId;
    const ssid24 = req.body?.ssid24 || device?.wifiInfo?.ssid24Masked || "JustFiber";
    const ssid5 = req.body?.ssid5 || device?.wifiInfo?.ssid5Masked || "JustFiber";
    const wifiPassword24 = req.body?.password24 || req.body?.password;
    const wifiPassword5 = req.body?.password5 || req.body?.password24 || req.body?.password;
    const pppoeUsername = req.body?.pppoeUsername || device?.wanInfo?.pppoeUsernameMasked;
    const pppoePassword = req.body?.pppoePassword;
    const natEnabled = req.body?.natEnabled ?? device?.wifiInfo?.natEnabled ?? true;
    const brand = detectOntBrand({
      serialNumber: device?.serialNumber,
      productClass: device?.productClass,
      deviceId: targetDeviceId
    });
    await genieacsClient.pushAccessConfig({
      deviceId: targetDeviceId,
      brand,
      pppoeUsername,
      pppoePassword,
      vlanId: device?.wanInfo?.vlanId,
      natEnabled,
      ssid24,
      ssid5,
      wifiPassword24,
      wifiPassword5
    });
    if (brand === "nokia" && (wifiPassword24 || wifiPassword5)) {
      await genieacsClient.rebootDevice(targetDeviceId);
    }
    if (device) {
      device.wifiInfo = {
        ...(device.wifiInfo || {}),
        ssid24Masked: ssid24,
        ssid5Masked: ssid5,
        natEnabled
      };
      device.wanInfo = {
        ...(device.wanInfo || {}),
        ...(pppoeUsername ? { pppoeUsernameMasked: pppoeUsername } : {})
      };
      await device.save();
    }
    return ok(res, { deviceId: targetDeviceId, ssid24, ssid5, pppoeUsername, natEnabled, updated: true, cacheBacked: Boolean(device) });
  })
);

adminOpsRouter.get(
  "/billing/ledger",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.direction) filter.direction = req.query.direction;
    const [items, total] = await Promise.all([
      BillingLedgerEntry.find(filter).sort({ postedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      BillingLedgerEntry.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.post(
  "/billing/run-cycle",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const result = await internalBillingEngine.runBillingCycle({
      customerId: req.body?.customerId,
      serviceId: req.body?.serviceId,
      totalAmount: req.body?.totalAmount,
      paymentStatus: req.body?.paymentStatus
    });
    await auditFromRequest(req, {
      action: "billing.cycle.run",
      entityType: "billing_cycle",
      entityId: req.body?.customerId || req.body?.serviceId || "all",
      metadata: { processed: result.processed, created: result.created, skipped: result.skipped }
    });
    return ok(res, result);
  })
);

adminOpsRouter.post(
  "/billing/ledger/adjustment",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.body?.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Valid positive amount is required");
    }
    const direction = req.body?.direction === "credit" ? "credit" : "debit";
    const category = direction === "credit" ? "credit_adjustment" : "debit_adjustment";
    const entry = await createLedgerEntry({
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      category,
      direction,
      amount,
      reference: req.body?.reference,
      note: req.body?.note || `Manual ${category.replace("_", " ")}`,
      source: "admin_manual_adjustment",
      createdByAdminId: req.admin?._id,
      metadata: {
        requestId: req.requestId,
        reason: req.body?.reason
      }
    });
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      dueAmount: Math.max(0, entry.balanceAfter)
    };
    await customer.save();
    await auditFromRequest(req, {
      action: "billing.adjustment.created",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: { ledgerEntryId: entry.entryId, direction, amount }
    });
    return ok(res, entry, { created: true });
  })
);

adminOpsRouter.post(
  "/billing/refunds",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.body?.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Valid positive amount is required");
    }
    const refundId = req.body?.refundId || `REF-${Date.now()}`;
    const entry = await createLedgerEntry({
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      paymentId: req.body?.paymentId,
      category: "refund",
      direction: "credit",
      amount,
      reference: refundId,
      note: req.body?.note || "Customer refund issued",
      source: "admin_refund",
      createdByAdminId: req.admin?._id,
      metadata: {
        requestId: req.requestId,
        paymentId: req.body?.paymentId
      }
    });
    await PaymentTransaction.create({
      transactionId: refundId,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      provider: "manual_refund",
      amount,
      status: "success",
      paidAt: new Date(),
      method: "refund",
      reference: refundId,
      metadata: {
        source: "admin_refund",
        originalPaymentId: req.body?.paymentId
      }
    });
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      dueAmount: Math.max(0, entry.balanceAfter),
      lastRefundAt: new Date()
    };
    await customer.save();
    await auditFromRequest(req, {
      action: "billing.refund.created",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: { ledgerEntryId: entry.entryId, refundId, amount }
    });
    return ok(res, entry, { created: true });
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

adminOpsRouter.get(
  "/integrations",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await IntegrationConnection.find({}).sort({ category: 1, displayName: 1 }).lean();
    return ok(res, items);
  })
);

adminOpsRouter.post(
  "/integrations",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const key = String(req.body?.key || "").trim();
    const provider = String(req.body?.provider || "").trim();
    const category = String(req.body?.category || "").trim();
    if (!key || !provider || !category) {
      throw new ApiError(400, "key, provider, and category are required");
    }
    const integration = await IntegrationConnection.findOneAndUpdate(
      { key },
      {
        $set: {
          category,
          provider,
          displayName: String(req.body?.displayName || provider).trim(),
          status: req.body?.status || "inactive",
          mode: req.body?.mode || "sandbox",
          capabilities: Array.isArray(req.body?.capabilities) ? req.body.capabilities : [],
          credentialsMasked: req.body?.credentialsMasked || {},
          config: req.body?.config || {},
          health: req.body?.health || {},
          lastCheckedAt: req.body?.health ? new Date() : undefined,
          notes: req.body?.notes
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    await auditFromRequest(req, {
      action: "integration.upserted",
      entityType: "integration",
      entityId: integration.key,
      metadata: { category: integration.category, provider: integration.provider }
    });
    return ok(res, integration, { created: true });
  })
);

adminOpsRouter.patch(
  "/integrations/:key",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const integration = await IntegrationConnection.findOneAndUpdate(
      { key: req.params.key },
      {
        $set: {
          ...(req.body?.displayName ? { displayName: req.body.displayName } : {}),
          ...(req.body?.status ? { status: req.body.status } : {}),
          ...(req.body?.mode ? { mode: req.body.mode } : {}),
          ...(req.body?.capabilities ? { capabilities: req.body.capabilities } : {}),
          ...(req.body?.credentialsMasked ? { credentialsMasked: req.body.credentialsMasked } : {}),
          ...(req.body?.config ? { config: req.body.config } : {}),
          ...(req.body?.health ? { health: req.body.health, lastCheckedAt: new Date() } : {}),
          ...(req.body?.notes !== undefined ? { notes: req.body.notes } : {})
        }
      },
      { new: true }
    ).lean();
    if (!integration) {
      throw new ApiError(404, "Integration not found");
    }
    await auditFromRequest(req, {
      action: "integration.updated",
      entityType: "integration",
      entityId: integration.key,
      metadata: { status: integration.status, mode: integration.mode }
    });
    return ok(res, integration);
  })
);
