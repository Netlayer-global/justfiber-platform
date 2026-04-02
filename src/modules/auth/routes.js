import argon2 from "argon2";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ApiError } from "../../common/ApiError.js";
import { ok } from "../../common/response.js";
import { loginSchema, refreshSchema } from "./schemas.js";
import { AdminUser } from "../../models/AdminUser.js";
import { AdminSession } from "../../models/AdminSession.js";
import { signAccessToken, signRefreshToken, requireAuth, resolvePermissions } from "../../common/auth.js";
import { env } from "../../config/env.js";
import { auditFromRequest } from "../../common/audit.js";
import { permissions } from "../../config/permissions.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const loginValue = String(payload.login || "").trim();
    const normalizedLogin = loginValue.toLowerCase();
    const admin = await AdminUser.findOne({
      $or: [{ email: normalizedLogin }, { username: normalizedLogin }, { email: loginValue }, { username: loginValue }]
    });
    if (!admin || !(await argon2.verify(admin.passwordHash, payload.password))) {
      throw new ApiError(401, "Invalid username/email or password");
    }
    if (admin.status !== "active") {
      throw new ApiError(403, admin.status === "locked" ? "Admin account is locked" : "Admin account is disabled");
    }

    const accessToken = signAccessToken(admin);
    const refreshToken = signRefreshToken(admin);
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const decoded = jwt.decode(refreshToken);

    await AdminSession.create({
      adminUserId: admin._id,
      refreshTokenHash,
      deviceInfo: req.get("user-agent"),
      ip: req.ip,
      userAgent: req.get("user-agent"),
      expiresAt: new Date(decoded.exp * 1000)
    });

    admin.lastLoginAt = new Date();
    admin.lastLoginIp = req.ip;
    await admin.save();

    await auditFromRequest(req, {
      action: "admin.auth.login",
      entityType: "admin_user",
      entityId: admin._id.toString()
    });

    return ok(res, {
      accessToken,
      refreshToken
    });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const payload = refreshSchema.parse(req.body);
    let decoded;
    try {
      decoded = jwt.verify(payload.refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new ApiError(401, "Invalid refresh token");
    }

    const refreshTokenHash = crypto.createHash("sha256").update(payload.refreshToken).digest("hex");
    const session = await AdminSession.findOne({
      adminUserId: decoded.sub,
      refreshTokenHash,
      revokedAt: null
    });

    if (!session) {
      throw new ApiError(401, "Session is invalid");
    }

    const admin = await AdminUser.findById(decoded.sub);
    if (!admin || admin.status !== "active") {
      throw new ApiError(401, "Admin not active");
    }

    const accessToken = signAccessToken(admin);
    return ok(res, { accessToken });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const grantedPermissions = await resolvePermissions(req.admin);
    const canAccessAllZones =
      Boolean(req.admin.canAccessAllZones) ||
      !req.admin.zoneCode ||
      Array.isArray(req.admin.roles) && req.admin.roles.includes("super_admin") ||
      grantedPermissions.includes(permissions.adminUserManage) ||
      grantedPermissions.includes(permissions.adminRoleManage);
    return ok(res, {
      id: req.admin._id,
      username: req.admin.username,
      fullName: req.admin.fullName,
      email: req.admin.email,
      zoneCode: canAccessAllZones ? "" : req.admin.zoneCode || "",
      zoneName: canAccessAllZones ? "" : req.admin.zoneName || "",
      canAccessAllZones,
      roles: req.admin.roles,
      permissions: grantedPermissions
    });
  })
);
