import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { AdminUser } from "../../models/AdminUser.js";
import { Role } from "../../models/Role.js";
import { buildPagination } from "../../common/pagination.js";
import { auditFromRequest } from "../../common/audit.js";

const createUserSchema = z.object({
  username: z.string().min(3),
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(z.string()).min(1),
  phone: z.string().optional(),
  zoneCode: z.string().optional(),
  zoneName: z.string().optional(),
  canAccessAllZones: z.boolean().optional()
});

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth);

adminUsersRouter.get(
  "/users",
  requirePermission(permissions.adminUserManage),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.zoneCode) filter.zoneCode = req.query.zoneCode;
    const [items, total] = await Promise.all([
      AdminUser.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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
    const passwordHash = await argon2.hash(payload.password);
    const user = await AdminUser.create({
      username: payload.username,
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      passwordHash,
      roles: payload.roles,
      zoneCode: payload.zoneCode,
      zoneName: payload.zoneName,
      canAccessAllZones: Boolean(payload.canAccessAllZones),
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
    return ok(res, user, { created: true });
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
