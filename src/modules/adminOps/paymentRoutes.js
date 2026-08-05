import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { requireAuth } from "../../common/auth.js";
import { requireInstallerAuth } from "../../common/installerAuth.js";
import { Customer } from "../../models/Customer.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { reconcilePaymentToInvoice, syncCustomerBillingState } from "../../common/billingAccounting.js";
import { serviceControlAdapter } from "../../integrations/serviceControlAdapter.js";

export const paymentRouter = Router();

/**
 * Combined auth middleware: accepts either admin JWT or installer JWT.
 * Tries admin auth first; if that fails, falls back to installer auth.
 */
function requireAdminOrInstaller(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }
  // Try admin auth first, fall back to installer auth
  requireAuth(req, res, (err) => {
    if (!err) return next();
    requireInstallerAuth(req, res, next);
  });
}

const VALID_METHODS = ["cash", "onlinePayment", "manualCollection"];

paymentRouter.post(
  "/collect-cash",
  requireAdminOrInstaller,
  asyncHandler(async (req, res) => {
    const { customerId, amount, method, notes } = req.body;

    // Validate customerId
    if (!customerId) {
      throw new ApiError(400, "customerId is required");
    }

    // Validate amount
    const numAmount = Number(amount);
    if (amount === undefined || amount === null || amount === "") {
      throw new ApiError(400, "amount is required");
    }
    if (!Number.isFinite(numAmount) || numAmount < 0.01 || numAmount > 999999.99) {
      throw new ApiError(400, "amount must be between 0.01 and 999999.99");
    }

    // Validate method
    if (!method) {
      throw new ApiError(400, "method is required");
    }
    if (!VALID_METHODS.includes(method)) {
      throw new ApiError(400, `method must be one of: ${VALID_METHODS.join(", ")}`);
    }

    // Validate notes (optional)
    if (notes !== undefined && notes !== null && typeof notes === "string" && notes.length > 500) {
      throw new ApiError(400, "notes must be 500 characters or fewer");
    }

    // Resolve customer
    let customer = await Customer.findOne({ customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    // Build notes with collector info
    const collectorName = req.admin?.name || req.admin?.fullName || req.installer?.name || req.installer?.fullName || "System";
    const fullNotes = notes
      ? `${notes} | Collected by: ${collectorName}`
      : `Cash collected by: ${collectorName}`;

    // 1. Create local payment transaction
    const transactionId = `TXN-CASH-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payment = await PaymentTransaction.create({
      transactionId,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      provider: "manual_cash",
      amount: numAmount,
      status: "success",
      paidAt: new Date(),
      method,
      reference: notes || "Cash collection",
      unallocatedAmount: numAmount,
      metadata: {
        collectorName,
        source: "admin_collect_cash"
      }
    });

    // 2. Find oldest open invoice
    const invoice = await BillingInvoice.findOne({
      customerId: customer.customerId,
      paymentStatus: { $in: ["pending", "overdue"] }
    }).sort({ dueDate: 1, generatedAt: 1 });

    if (invoice) {
      // 3. Reconcile to open invoice (this also runs syncCustomerBillingState internally)
      const settlement = await reconcilePaymentToInvoice({
        payment,
        invoice,
        confidenceScore: 1,
        matchReason: "Manual cash payment reconciled against open invoice",
        matchedBy: "admin_user",
        reconciliationMode: "manual",
        reconciledByAdminId: req.admin?._id || req.installer?._id,
        ledgerSource: "manual_cash_collection",
        ledgerNote: fullNotes,
        ledgerMetadata: {
          collectorName
        }
      });
      customer = settlement.customer || customer;
    } else {
      // 3b. Just sync billing state if no open invoice
      const updated = await syncCustomerBillingState(customer.customerId, customer);
      if (updated) customer = updated;
    }

    // 4. Auto-resume if suspended and dueAmount is <= 0
    let resumed = false;
    let serviceControlResult = null;
    const dueAmount = customer.billingSnapshot?.dueAmount ?? 0;
    if (customer.operationalStatus === "suspended" && dueAmount <= 0 && customer.serviceId) {
      serviceControlResult = await serviceControlAdapter.resumeSubscriberAccess({
        serviceId: customer.serviceId
      });
      customer.operationalStatus = "active";
      await customer.save();
      resumed = true;
    }

    return ok(res, {
      transactionId,
      customerId,
      amount: numAmount,
      method,
      notes: fullNotes,
      recordedAt: new Date().toISOString(),
      resumed,
      dueAmountAfterPayment: dueAmount
    });
  })
);
