import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";
import { AdminUser } from "../models/AdminUser.js";
import { Role } from "../models/Role.js";

export function signAccessToken(admin) {
  return jwt.sign(
    {
      sub: admin._id.toString(),
      roles: admin.roles
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL }
  );
}

export function signRefreshToken(admin) {
  return jwt.sign(
    {
      sub: admin._id.toString()
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL }
  );
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    const admin = await AdminUser.findById(payload.sub).lean();
    if (!admin || admin.status !== "active") {
      throw new ApiError(401, "Session is invalid");
    }
    req.admin = admin;
    return next();
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(401, "Invalid token"));
  }
}

export async function resolvePermissions(admin) {
  const roles = await Role.find({ code: { $in: admin.roles } }).lean();
  const rolePermissions = roles.flatMap((role) => role.permissions);
  const allow = admin.permissionOverrides?.allow || [];
  const deny = new Set(admin.permissionOverrides?.deny || []);
  return [...new Set([...rolePermissions, ...allow])].filter((permission) => !deny.has(permission));
}

export function requirePermission(permission) {
  return async (req, _res, next) => {
    if (!req.admin) {
      return next(new ApiError(401, "Authentication required"));
    }
    const granted = await resolvePermissions(req.admin);
    if (!granted.includes(permission)) {
      return next(new ApiError(403, `Missing permission: ${permission}`));
    }
    req.grantedPermissions = granted;
    return next();
  };
}
