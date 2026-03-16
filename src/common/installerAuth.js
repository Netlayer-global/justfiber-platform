import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";
import { Installer } from "../models/Installer.js";
import { InstallerSession } from "../models/InstallerSession.js";

export function signInstallerAccessToken(installer) {
  return jwt.sign(
    {
      sub: installer._id.toString(),
      roles: installer.roles,
      scope: "installer"
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL }
  );
}

export function signInstallerRefreshToken(installer) {
  return jwt.sign(
    {
      sub: installer._id.toString(),
      scope: "installer"
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL }
  );
}

export async function requireInstallerAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Installer authentication required"));
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    if (payload.scope !== "installer") {
      throw new ApiError(401, "Invalid installer scope");
    }
    const installer = await Installer.findById(payload.sub);
    if (!installer || installer.status !== "active") {
      throw new ApiError(401, "Installer session is invalid");
    }
    req.installer = installer;
    return next();
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(401, "Invalid installer token"));
  }
}

export async function persistInstallerSession({ installer, refreshToken, req }) {
  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const decoded = jwt.decode(refreshToken);
  return InstallerSession.create({
    installerId: installer._id,
    refreshTokenHash,
    deviceId: req.body?.deviceId,
    appVersion: req.body?.appVersion,
    ip: req.ip,
    expiresAt: new Date(decoded.exp * 1000)
  });
}
