import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { Customer } from "../../models/Customer.js";
import { env } from "../../config/env.js";

export const jazeWebhookRouter = Router();

// Verify webhook signature/secret
function verifyJazeWebhook(req, res, next) {
  const secret = req.headers["x-jaze-webhook-secret"] || req.query.secret;
  if (!env.JAZE_WEBHOOK_SECRET || secret !== env.JAZE_WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, error: "Invalid webhook secret" });
  }
  next();
}

// POST /api/v1/webhooks/jaze
jazeWebhookRouter.post(
  "/jaze",
  verifyJazeWebhook,
  asyncHandler(async (req, res) => {
    const { event, data } = req.body;

    switch (event) {
      case "payment.success":
      case "payment.received": {
        // Payment was made in Jaze — update customer's last payment info
        const { userId, amount, method, transactionId, paidAt } = data || {};
        if (userId) {
          await Customer.updateOne(
            { jazeUserId: String(userId) },
            {
              $set: {
                "billingSnapshot.lastPaymentAmount": amount,
                "billingSnapshot.lastPaymentDate": paidAt || new Date().toISOString(),
                "billingSnapshot.lastPaymentMethod": method || "online",
                "billingSnapshot.lastPaymentTransactionId": transactionId || null,
                lastJazeSync: new Date(),
              },
            }
          );
        }
        break;
      }

      case "user.suspended":
      case "user.blocked": {
        // User was suspended in Jaze — sync to JustFiber
        const { userId, reason } = data || {};
        if (userId) {
          await Customer.updateOne(
            { jazeUserId: String(userId) },
            {
              $set: {
                status: "suspended",
                jazeStatus: "suspended",
                "billingSnapshot.suspensionReason": reason || "Suspended by Jaze",
                lastJazeSync: new Date(),
              },
            }
          );
        }
        break;
      }

      case "user.activated":
      case "user.unblocked": {
        // User was activated/unblocked in Jaze — sync to JustFiber
        const { userId } = data || {};
        if (userId) {
          await Customer.updateOne(
            { jazeUserId: String(userId) },
            {
              $set: {
                status: "active",
                jazeStatus: "active",
                "billingSnapshot.suspensionReason": null,
                lastJazeSync: new Date(),
              },
            }
          );
        }
        break;
      }

      case "user.plan_changed": {
        // Plan was changed in Jaze — sync to JustFiber
        const { userId, newGroupId, newGroupName } = data || {};
        if (userId) {
          await Customer.updateOne(
            { jazeUserId: String(userId) },
            {
              $set: {
                "billingSnapshot.currentPlanName": newGroupName || null,
                "billingSnapshot.jazeGroupId": newGroupId || null,
                lastJazeSync: new Date(),
              },
            }
          );
        }
        break;
      }

      case "invoice.generated": {
        // New invoice generated in Jaze
        const { userId, invoiceId, amount, dueDate } = data || {};
        if (userId) {
          await Customer.updateOne(
            { jazeUserId: String(userId) },
            {
              $set: {
                "billingSnapshot.latestInvoiceId": invoiceId || null,
                "billingSnapshot.dueAmount": amount || 0,
                "billingSnapshot.dueDate": dueDate || null,
                lastJazeSync: new Date(),
              },
            }
          );
        }
        break;
      }

      default:
        // Unknown event — log and acknowledge
        console.log(`[JazeWebhook] Unknown event: ${event}`, data);
    }

    return ok(res, { received: true, event });
  })
);
