import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { applyPresetSchema } from "./schemas.js";
import { AdminActionRequest } from "../../models/AdminActionRequest.js";
import { adminActionsQueue } from "../../queues/adminActionsQueue.js";
import { auditFromRequest } from "../../common/audit.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";

export const devicesRouter = Router();

devicesRouter.use(requireAuth);

devicesRouter.get(
  "/",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { deviceId: req.query.search },
        { serialNumber: req.query.search },
        { customerId: req.query.search },
        { serviceId: req.query.search }
      ];
    }
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    if (req.query.onlineStatus) {
      filter.onlineStatus = req.query.onlineStatus;
    }
    if (req.query.provisioningState) {
      filter.provisioningState = req.query.provisioningState;
    }
    const [items, total] = await Promise.all([
      DeviceOperationalCache.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      DeviceOperationalCache.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

devicesRouter.get(
  "/:deviceId",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId }).lean();
    if (!device) {
      throw new ApiError(404, "Device not found");
    }
    return ok(res, device);
  })
);

devicesRouter.post(
  "/:deviceId/apply-preset",
  requirePermission(permissions.deviceApplyPreset),
  asyncHandler(async (req, res) => {
    const payload = applyPresetSchema.parse(req.body);
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      throw new ApiError(404, "Device not found");
    }
    const request = await AdminActionRequest.create({
      actionType: "apply_preset",
      targetType: "device",
      targetId: device.deviceId,
      payload,
      requestedBy: req.admin._id,
      status: "approved"
    });
    await adminActionsQueue.add(
      "device-apply-preset",
      {
        actionRequestId: request._id.toString(),
        deviceId: device.deviceId,
        presetName: payload.presetName
      },
      {
        attempts: 4,
        backoff: {
          type: "exponential",
          delay: 2000
        },
        jobId: `action:${request._id.toString()}`
      }
    );
    await auditFromRequest(req, {
      action: "device.apply_preset.requested",
      entityType: "device",
      entityId: device.deviceId,
      metadata: payload
    });
    return ok(res, { actionRequestId: request._id, status: request.status });
  })
);

devicesRouter.post(
  "/:deviceId/reboot",
  requirePermission(permissions.deviceApplyPreset),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      throw new ApiError(404, "Device not found");
    }
    const request = await AdminActionRequest.create({
      actionType: "device_reboot",
      targetType: "device",
      targetId: device.deviceId,
      payload: { reason: req.body?.reason || "Manual reboot from admin" },
      requestedBy: req.admin._id,
      status: "approved"
    });
    await genieacsClient.rebootDevice(device.deviceId);
    request.status = "executed";
    await request.save();
    await auditFromRequest(req, {
      action: "device.reboot.requested",
      entityType: "device",
      entityId: device.deviceId,
      metadata: request.payload
    });
    return ok(res, { actionRequestId: request._id, status: request.status, queued: true, deviceId: device.deviceId });
  })
);
