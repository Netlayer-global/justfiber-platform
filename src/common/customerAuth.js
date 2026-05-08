import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";
import { CustomerUser } from "../models/CustomerUser.js";
import { CustomerSession } from "../models/CustomerSession.js";
import { Customer } from "../models/Customer.js";

function normalizeCustomerUserIdentifier(value = "") {
  return String(value || "").trim();
}

async function resolveCustomerUserLinkedIds(user) {
  if (!user) return [];
  const mobile = normalizeCustomerUserIdentifier(user.mobile);
  const email = normalizeCustomerUserIdentifier(user.email).toLowerCase();
  if (!mobile && !email) return [];
  const customers = await Customer.find({
    $or: [
      ...(mobile ? [{ mobile }, { phone: mobile }] : []),
      ...(email ? [{ email }] : [])
    ]
  })
    .select({ customerId: 1 })
    .lean();
  return Array.from(
    new Set(
      customers
        .map((item) => String(item.customerId || "").trim())
        .filter(Boolean)
    )
  );
}

export function signCustomerAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), scope: "customer" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL }
  );
}

export function signCustomerRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), scope: "customer" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL }
  );
}

export async function persistCustomerSession({ user, refreshToken }) {
  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const decoded = jwt.decode(refreshToken);
  await CustomerSession.create({
    customerUserId: user._id,
    refreshTokenHash,
    expiresAt: new Date(decoded.exp * 1000)
  });
}

export async function requireCustomerAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Customer authentication required"));
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    if (payload.scope !== "customer") {
      throw new ApiError(401, "Invalid customer scope");
    }
    const user = await CustomerUser.findById(payload.sub);
    if (!user) {
      throw new ApiError(401, "Customer session invalid");
    }
    const resolvedLinkedIds = await resolveCustomerUserLinkedIds(user);
    if (resolvedLinkedIds.length) {
      const mergedLinkedIds = Array.from(
        new Set([...(user.linkedCustomerIds || []), ...resolvedLinkedIds])
      );
      if (mergedLinkedIds.length !== (user.linkedCustomerIds || []).length) {
        user.linkedCustomerIds = mergedLinkedIds;
        await user.save();
      }
    }
    req.customerUser = user;
    return next();
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(401, "Invalid customer token"));
  }
}
