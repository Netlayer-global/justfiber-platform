import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ApiError } from "../../common/ApiError.js";
import { ok } from "../../common/response.js";
import { adminCanAccessAllZones, assertAdminZoneAccess, requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { AdminUser } from "../../models/AdminUser.js";
import { AdminSession } from "../../models/AdminSession.js";
import { Role } from "../../models/Role.js";
import { buildPagination } from "../../common/pagination.js";
import { auditFromRequest } from "../../common/audit.js";

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((value) => {
    const next = typeof value === "string" ? value.trim() : "";
    return next || undefined;
  });

const createUserSchema = z.object({
  username: z.string().min(3).transform((value) => value.trim()),
  fullName: z.string().min(2).transform((value) => value.trim()),
  email: optionalTrimmedString.refine((value) => !value || z.string().email().safeParse(value).success, "Invalid email"),
  password: z.string().min(8),
  roles: z.array(z.string()).min(1),
  phone: optionalTrimmedString,
  zoneCode: optionalTrimmedString,
  zoneName: optionalTrimmedString,
  canAccessAllZones: z.boolean().optional()
});

const updateUserStatusSchema = z.object({
  status: z.enum(["active", "disabled", "locked"])
});

const resetUserPasswordSchema = z.object({
  password: z.string().min(8)
});

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth);

const adminUserSafeSelect = {
  username: 1,
  fullName: 1,
  email: 1,
  phone: 1,
  status: 1,
  roles: 1,
  mfaEnabled: 1,
  lastLoginAt: 1,
  lastLoginIp: 1,
  passwordChangedAt: 1,
  zoneCode: 1,
  zoneName: 1,
  canAccessAllZones: 1,
  createdBy: 1,
  createdAt: 1,
  updatedAt: 1,
};

adminUsersRouter.get(
  "/users",
  requirePermission(permissions.adminUserManage),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    const scopedZoneCode = assertAdminZoneAccess(req.admin, req.query.zoneCode);
    if (scopedZoneCode) filter.zoneCode = scopedZoneCode;
    const [items, total] = await Promise.all([
      AdminUser.find(filter).select(adminUserSafeSelect).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdminUser.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminUsersRouter.post(
  "/users",
  requirePermission(permissions.adminUserManage),
  asyncHandler(async (req, res) => {
    const payload = createUserSchema.parse(req.body);
    const canManageAllZones = adminCanAccessAllZones(req.admin);
    const scopedZoneCode = assertAdminZoneAccess(req.admin, payload.zoneCode);
    if (!canManageAllZones && payload.canAccessAllZones) {
      throw new ApiError(403, "Only main admin can create all-zone logins");
    }
    if (!canManageAllZones && !scopedZoneCode) {
      throw new ApiError(403, "Admin is not assigned to a zone");
    }
    const userZoneCode = canManageAllZones ? payload.zoneCode : scopedZoneCode;
    const userZoneName = canManageAllZones ? payload.zoneName : req.admin.zoneName || scopedZoneCode;
    const normalizedUsername = payload.username.trim().toLowerCase();
    const fallbackZone = String(userZoneCode || "hq")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") || "hq";
    const normalizedEmail = (payload.email?.trim().toLowerCase()) || `${normalizedUsername}@${fallbackZone}.justfiber.local`;
    const duplicateFilter = [{ username: normalizedUsername }];
    if (normalizedEmail) duplicateFilter.push({ email: normalizedEmail });
    const existing = await AdminUser.findOne({ $or: duplicateFilter }).lean();
    if (existing) {
      if (String(existing.username || "").trim().toLowerCase() === normalizedUsername) {
        throw new ApiError(409, "Username already exists");
      }
      throw new ApiError(409, "Email already exists");
    }

    const passwordHash = await argon2.hash(payload.password);
    const user = await AdminUser.create({
      username: normalizedUsername,
      fullName: payload.fullName,
      email: normalizedEmail,
      phone: payload.phone,
      passwordHash,
      roles: payload.roles,
      zoneCode: userZoneCode,
      zoneName: userZoneName,
      canAccessAllZones: canManageAllZones ? Boolean(payload.canAccessAllZones) : false,
      passwordChangedAt: new Date(),
      createdBy: req.admin._id
    });
    await auditFromRequest(req, {
      action: "admin.user.created",
      entityType: "admin_user",
      entityId: user._id.toString(),
      after: {
        username: user.username,
        email: user.email,
        roles: user.roles,
        zoneCode: user.zoneCode,
        zoneName: user.zoneName,
        canAccessAllZones: user.canAccessAllZones
      }
    });
    const safeUser = await AdminUser.findById(user._id).select(adminUserSafeSelect).lean();
    return ok(res, safeUser, { created: true });
  })
);

adminUsersRouter.patch(
  "/users/:userId/status",
  requirePermission(permissions.adminUserManage),
  asyncHandler(async (req, res) => {
    const payload = updateUserStatusSchema.parse(req.body || {});
    const user = await AdminUser.findById(req.params.userId);
    if (!user) {
      return ok(res, null, { found: false });
    }
    assertAdminZoneAccess(req.admin, user.zoneCode);
    user.status = payload.status;
    await user.save();
    if (payload.status !== "active") {
      await AdminSession.updateMany(
        { adminUserId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    await auditFromRequest(req, {
      action: "admin.user.status_updated",
      entityType: "admin_user",
      entityId: user._id.toString(),
      after: {
        status: user.status,
        zoneCode: user.zoneCode,
        zoneName: user.zoneName
      }
    });
    const safeUser = await AdminUser.findById(user._id).select(adminUserSafeSelect).lean();
    return ok(res, safeUser);
  })
);

adminUsersRouter.post(
  "/users/:userId/reset-password",
  requirePermission(permissions.adminUserManage),
  asyncHandler(async (req, res) => {
    const payload = resetUserPasswordSchema.parse(req.body || {});
    const user = await AdminUser.findById(req.params.userId);
    if (!user) {
      return ok(res, null, { found: false });
    }
    assertAdminZoneAccess(req.admin, user.zoneCode);
    user.passwordHash = await argon2.hash(payload.password);
    user.passwordChangedAt = new Date();
    await user.save();
    await AdminSession.updateMany(
      { adminUserId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    await auditFromRequest(req, {
      action: "admin.user.password_reset",
      entityType: "admin_user",
      entityId: user._id.toString(),
      metadata: {
        zoneCode: user.zoneCode,
        zoneName: user.zoneName
      }
    });
    return ok(res, { reset: true, userId: user._id.toString() });
  })
);

adminUsersRouter.get(
  "/roles",
  requirePermission(permissions.adminRoleManage),
  asyncHandler(async (_req, res) => {
    const roles = await Role.find().sort({ code: 1 }).lean();
    return ok(res, roles);
  })
);
