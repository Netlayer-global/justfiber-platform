import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { SystemConfig } from "../../models/SystemConfig.js";
import { updateConfigSchema } from "./schemas.js";
import { auditFromRequest } from "../../common/audit.js";

export const configsRouter = Router();

configsRouter.use(requireAuth);

configsRouter.get(
  "/",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const configs = await SystemConfig.find().sort({ category: 1, key: 1 }).lean();
    return ok(res, configs);
  })
);

configsRouter.patch(
  "/:key",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = updateConfigSchema.parse(req.body);
    let config = await SystemConfig.findOne({ key: req.params.key });
    const previous = config?.toObject();
    if (!config) {
      config = new SystemConfig({
        key: req.params.key,
        ...payload,
        history: []
      });
    } else {
      config.history.push({
        version: config.version,
        value: config.value,
        updatedBy: config.updatedBy,
        updatedAt: config.updatedAt
      });
      config.value = payload.value;
      config.valueType = payload.valueType;
      config.category = payload.category;
      config.version += 1;
    }
    config.updatedBy = req.admin._id;
    await config.save();
    await auditFromRequest(req, {
      action: "config.updated",
      entityType: "config",
      entityId: config.key,
      before: previous,
      after: config.toObject()
    });
    return ok(res, config);
  })
);
