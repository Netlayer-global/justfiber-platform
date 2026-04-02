import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { DashboardSnapshot } from "../../models/DashboardSnapshot.js";
import { permissions } from "../../config/permissions.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
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

dashboardRouter.get(
  "/executive",
  asyncHandler(async (_req, res) => {
    const liveCustomerIdsPromise = DeviceOperationalCache.distinct("customerId", {
      customerId: { $nin: [null, ""] },
      $or: [
        { onlineStatus: "online" },
        { "wanInfo.sessionStatus": { $in: ["up", "UP", "Up"] } },
        { "wanInfo.ipv4Address": { $exists: true, $nin: ["", null] } },
        { "wanInfo.ipAddress": { $exists: true, $nin: ["", null] } }
      ]
    });

    const [snapshot, customers, suspended, inactive, devicesOffline, openCriticalTickets, liveCustomerIds] = await Promise.all([
      fetchLatestSnapshot("executive"),
      Customer.countDocuments(),
      Customer.countDocuments({ operationalStatus: "suspended" }),
      Customer.countDocuments({ operationalStatus: "inactive" }),
      DeviceOperationalCache.countDocuments({ onlineStatus: "offline" }),
      SupportTicket.countDocuments({ status: { $in: ["open", "assigned", "in_progress"] }, priority: "critical" }),
      liveCustomerIdsPromise
    ]);

    const liveOnlineUsers = Array.isArray(liveCustomerIds) ? liveCustomerIds.length : 0;
    const activeUsers = Math.max(customers - suspended - inactive, 0);

    return ok(res, {
      ...(snapshot || {}),
      totalCustomers: customers,
      onlineUsers: liveOnlineUsers,
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
  asyncHandler(async (_req, res) => {
    const snapshot = await fetchLatestSnapshot("network");
    if (snapshot) {
      return ok(res, snapshot);
    }

    const [bngsUp, bngsDown, oltsUp, totalNodes, devicesOnline, devicesOffline] = await Promise.all([
      NetworkNodeStatus.countDocuments({ nodeType: "bng", status: "up" }),
      NetworkNodeStatus.countDocuments({ nodeType: "bng", status: { $in: ["down", "degraded"] } }),
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

dashboardRouter.get(
  "/billing",
  asyncHandler(async (_req, res) => {
    const snapshot = await fetchLatestSnapshot("billing");
    if (snapshot) {
      return ok(res, snapshot);
    }

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
