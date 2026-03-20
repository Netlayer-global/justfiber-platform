import argon2 from "argon2";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { Installer } from "../../models/Installer.js";
import { InstallerSession } from "../../models/InstallerSession.js";
import { installerLoginSchema, installerRefreshSchema } from "./schemas.js";
import {
  persistInstallerSession,
  requireInstallerAuth,
  signInstallerAccessToken,
  signInstallerRefreshToken
} from "../../common/installerAuth.js";
import { env } from "../../config/env.js";

export const installerAuthRouter = Router();

installerAuthRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = installerLoginSchema.parse(req.body);
    const installer = await Installer.findOne({
      $or: [{ phone: payload.login }, { email: payload.login }, { installerCode: payload.login }]
    });
    if (!installer || !(await argon2.verify(installer.passwordHash, payload.password))) {
      throw new ApiError(401, "Invalid installer credentials");
    }
    if (installer.currentLeave?.isOnLeave) {
      throw new ApiError(403, "Installer is currently on leave");
    }

    const accessToken = signInstallerAccessToken(installer);
    const refreshToken = signInstallerRefreshToken(installer);
    await persistInstallerSession({ installer, refreshToken, req });

    installer.lastLoginAt = new Date();
    installer.lastSeenAt = new Date();
    await installer.save();

    return ok(res, {
      accessToken,
      refreshToken
    });
  })
);

installerAuthRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const payload = installerRefreshSchema.parse(req.body);
    const decoded = jwt.verify(payload.refreshToken, env.JWT_REFRESH_SECRET);
    if (decoded.scope !== "installer") {
      throw new ApiError(401, "Invalid installer refresh scope");
    }

    const refreshTokenHash = crypto.createHash("sha256").update(payload.refreshToken).digest("hex");
    const session = await InstallerSession.findOne({
      installerId: decoded.sub,
      refreshTokenHash,
      revokedAt: null
    });
    if (!session) {
      throw new ApiError(401, "Installer session is invalid");
    }

    const installer = await Installer.findById(decoded.sub);
    if (!installer || installer.status !== "active") {
      throw new ApiError(401, "Installer not active");
    }

    return ok(res, {
      accessToken: signInstallerAccessToken(installer)
    });
  })
);

installerAuthRouter.get(
  "/me",
  requireInstallerAuth,
  asyncHandler(async (req, res) => {
    return ok(res, {
      id: req.installer._id,
      installerCode: req.installer.installerCode,
      fullName: req.installer.fullName,
      phone: req.installer.phone,
      availabilityStatus: req.installer.availabilityStatus,
      assignedZones: req.installer.assignedZones,
      skills: req.installer.skills
    });
  })
);
