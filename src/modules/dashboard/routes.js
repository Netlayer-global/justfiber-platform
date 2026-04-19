import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { DashboardSnapshot } from "../../models/DashboardSnapshot.js";
import { permissions } from "../../config/permissions.js";
import { adminCanAccessAllZones, assertAdminZoneAccess, requireAuth, requirePermission } from "../../common/auth.js";
import { Customer } from "../../models/Customer.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { NetworkNodeStatus } from "../../models/NetworkNodeStatus.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { SupportTicket } from "../../models/SupportTicket.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requirePermission(permissions.dashboardRead));

async function fetchLatestSnapshot(snapshotType) {
  const snapshot = await DashboardSnapshot.findOne({ snapshotType }).sort({ generatedAt: -1 }).lean();
  return snapshot?.metrics || null;
}

function buildCustomerZoneFilter(zoneCode = "") {
  const normalized = String(zoneCode || "").trim();
  if (!normalized) return {};
  return {
    $or: [
      { zoneCode: normalized },
      { billingZoneCode: normalized },
      { "billingSnapshot.billingZoneCode": normalized },
      { "billingSnapshot.zoneCode": normalized }
    ]
  };
}

async function resolveDashboardScope(req) {
  const zoneCode = assertAdminZoneAccess(req.admin, req.query?.zoneCode);
  const customerFilter = buildCustomerZoneFilter(zoneCode);
  if (!zoneCode) {
    return {
      zoneCode,
      customerFilter,
      customerIdFilter: {},
      invoiceFilter: {},
      canUseGlobalSnapshot: adminCanAccessAllZones(req.admin)
    };
  }

  const customerIds = await Customer.distinct("customerId", customerFilter);
  const customerIdFilter = { customerId: { $in: customerIds } };
  return {
    zoneCode,
    customerFilter,
    customerIdFilter,
    invoiceFilter: {
      $or: [
        { billingZoneCode: zoneCode },
        { "metadata.billingZoneCode": zoneCode },
        customerIdFilter
      ]
    },
    canUseGlobalSnapshot: false
  };
}

dashboardRouter.get(
  "/executive",
  asyncHandler(async (req, res) => {
    const scope = await resolveDashboardScope(req);
    const liveDeviceFilter = {
      ...scope.customerIdFilter,
      customerId: {
        ...(scope.customerIdFilter.customerId || {}),
        $nin: [null, ""]
      },
      $or: [
        { onlineStatus: "online" },
        { "wanInfo.sessionStatus": { $in: ["up", "UP", "Up"] } },
        { "wanInfo.ipv4Address": { $exists: true, $nin: ["", null] } },
        { "wanInfo.ipAddress": { $exists: true, $nin: ["", null] } }
      ]
    };
    const liveCustomerIdsPromise = DeviceOperationalCache.distinct("customerId", liveDeviceFilter);

    const [snapshot, customers, suspended, inactive, activeUsers, devicesOffline, openCriticalTickets, liveCustomerIds, activeCustomerIds] = await Promise.all([
      scope.canUseGlobalSnapshot ? fetchLatestSnapshot("executive") : Promise.resolve(null),
      Customer.countDocuments(scope.customerFilter),
      Customer.countDocuments({ ...scope.customerFilter, operationalStatus: "suspended" }),
      Customer.countDocuments({ ...scope.customerFilter, operationalStatus: "inactive" }),
      Customer.countDocuments({ ...scope.customerFilter, operationalStatus: { $nin: ["suspended", "inactive"] } }),
      DeviceOperationalCache.countDocuments({ ...scope.customerIdFilter, onlineStatus: "offline" }),
      SupportTicket.countDocuments({ ...scope.customerIdFilter, status: { $in: ["open", "assigned", "in_progress"] }, priority: "critical" }),
      liveCustomerIdsPromise,
      Customer.distinct("customerId", { ...scope.customerFilter, operationalStatus: { $nin: ["suspended", "inactive"] } })
    ]);

    const activeCustomerIdSet = new Set(
      (Array.isArray(activeCustomerIds) ? activeCustomerIds : []).map((item) => String(item || "").trim()).filter(Boolean)
    );
    const linkedDeviceCustomerIds = new Set(
      (Array.isArray(liveCustomerIds) ? liveCustomerIds : [])
        .map((item) => String(item || "").trim())
        .filter((item) => item && activeCustomerIdSet.has(item))
    );
    const liveOnlineUsers = linkedDeviceCustomerIds.size;

    return ok(res, {
      ...(snapshot || {}),
      totalCustomers: customers,
      onlineUsers: liveOnlineUsers,
      activeConnections: liveOnlineUsers,
      activeUsers,
      suspendedCustomers: suspended,
      inactiveCustomers: inactive,
      offlineDevices: devicesOffline,
      openCriticalTickets
    });
  })
);

dashboardRouter.get(
  "/network",
  asyncHandler(async (req, res) => {
    const scope = await resolveDashboardScope(req);
    const snapshot = scope.canUseGlobalSnapshot ? await fetchLatestSnapshot("network") : null;
    if (snapshot) {
      return ok(res, snapshot);
    }

    const [bngsUp, bngsDown, oltsUp, totalNodes, devicesOnline, devicesOffline] = await Promise.all([
      scope.zoneCode ? Promise.resolve(0) : NetworkNodeStatus.countDocuments({ nodeType: "bng", status: "up" }),
      scope.zoneCode ? Promise.resolve(0) : NetworkNodeStatus.countDocuments({ nodeType: "bng", status: { $in: ["down", "degraded"] } }),
      scope.zoneCode ? Promise.resolve(0) : NetworkNodeStatus.countDocuments({ nodeType: "olt", status: "up" }),
      scope.zoneCode ? Promise.resolve(0) : NetworkNodeStatus.countDocuments(),
      DeviceOperationalCache.countDocuments({ ...scope.customerIdFilter, onlineStatus: "online" }),
      DeviceOperationalCache.countDocuments({ ...scope.customerIdFilter, onlineStatus: "offline" })
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

dashboardRouter.get(
  "/billing",
  asyncHandler(async (req, res) => {
    const scope = await resolveDashboardScope(req);
    const snapshot = scope.canUseGlobalSnapshot ? await fetchLatestSnapshot("billing") : null;
    if (snapshot) {
      return ok(res, snapshot);
    }

    const [totalInvoices, overdueInvoices, paidTransactions, dueAmount, collectedAmount] = await Promise.all([
      BillingInvoice.countDocuments(scope.invoiceFilter),
      BillingInvoice.countDocuments({ ...scope.invoiceFilter, paymentStatus: "overdue" }),
      PaymentTransaction.countDocuments({ ...scope.customerIdFilter, status: "success" }),
      BillingInvoice.aggregate([
        { $match: { ...scope.invoiceFilter, paymentStatus: { $in: ["pending", "overdue"] } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      PaymentTransaction.aggregate([
        { $match: { ...scope.customerIdFilter, status: "success" } },
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
