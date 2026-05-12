import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { requireAuth } from "../../common/auth.js";
import { requireInstallerAuth } from "../../common/installerAuth.js";
import { Customer } from "../../models/Customer.js";
import { jazeClient } from "../../integrations/jazeClient.js";

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
    const customer = await Customer.findOne({ customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    if (!customer.jazeUserId) {
      throw new ApiError(404, "Customer is not activated (no Jaze account linked)");
    }

    // Build notes with collector info
    const collectorName = req.admin?.name || req.admin?.fullName || req.installer?.name || req.installer?.fullName || "System";
    const fullNotes = notes
      ? `${notes} | Collected by: ${collectorName}`
      : `Cash collected by: ${collectorName}`;

    // Call Jaze makePayment
    let jazeResponse;
    try {
      jazeResponse = await jazeClient.makePayment({
        userId: customer.jazeUserId,
        amount: numAmount,
        method,
        notes: fullNotes
      });
    } catch (err) {
      throw new ApiError(502, `Jaze payment failed: ${err.message}`);
    }

    return ok(res, {
      transactionId: jazeResponse?.transactionId || jazeResponse?.id || null,
      customerId,
      amount: numAmount,
      method,
      notes: fullNotes,
      recordedAt: new Date().toISOString()
    });
  })
);
