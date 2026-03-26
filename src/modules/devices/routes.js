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
import { getLiveGenieDeviceList, summarizeGenieDevice, syncCachedDevicesFromGenie, syncDeviceFromGenie } from "../../common/deviceOperationalSync.js";

export const devicesRouter = Router();

devicesRouter.use(requireAuth);

devicesRouter.get(
  "/",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (req, res) => {
    const useLiveView = String(req.query.live || "") === "true";
    if (String(req.query.sync || "") === "true") {
      await syncCachedDevicesFromGenie({ limit: Number(req.query.syncLimit || 50) });
    }
    const { page, limit, skip } = buildPagination(req.query);
    if (useLiveView) {
      let items = await getLiveGenieDeviceList(Number(req.query.liveLimit || limit || 100));
      if (req.query.search) {
        const needle = String(req.query.search).toLowerCase();
        items = items.filter((item) =>
          [item.deviceId, item.serialNumber, item.customerId, item.serviceId, item.productClass, item.wanInfo?.pppoeUsernameMasked]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)
        );
      }
      if (req.query.onlineStatus) {
        items = items.filter((item) => item.onlineStatus === req.query.onlineStatus);
      }
      if (req.query.provisioningState) {
        items = items.filter((item) => item.provisioningState === req.query.provisioningState);
      }
      const total = items.length;
      return ok(res, items.slice(skip, skip + limit), { page, limit, total });
    }
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
    const deviceRecord = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId });
    const useLiveView = String(req.query.live || "") === "true";
    if (deviceRecord && String(req.query.sync || "") === "true") {
      try {
        await syncDeviceFromGenie(deviceRecord);
      } catch (error) {
        console.error("[devices] Genie sync failed:", error);
      }
    }
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId }).lean();
    if (useLiveView) {
      const liveSummary = await genieacsClient.getRichDeviceSummary({
        deviceId: req.params.deviceId,
        serialNumber: device?.serialNumber
      });
      if (liveSummary) {
        const parsed = summarizeGenieDevice(liveSummary, req.params.deviceId);
        return ok(res, {
          ...(device || {}),
          ...parsed,
          customerId: device?.customerId || null,
          serviceId: device?.serviceId || null,
          provisioningState: device?.provisioningState || "live_only",
          wanInfo: {
            ...(device?.wanInfo || {}),
            ...(parsed.wanInfo || {})
          },
          wifiInfo: {
            ...(device?.wifiInfo || {}),
            ...(parsed.wifiInfo || {})
          },
          opticalInfo: {
            ...(device?.opticalInfo || {}),
            ...(parsed.opticalInfo || {})
          },
          updatedAt: parsed.lastInformAt || device?.updatedAt || new Date()
        });
      }
    }
    if (device) {
      return ok(res, device);
    }
    const liveSummary = await genieacsClient.getRichDeviceSummary({ deviceId: req.params.deviceId });
    if (!liveSummary) {
      throw new ApiError(404, "Device not found");
    }
    const parsed = summarizeGenieDevice(liveSummary, req.params.deviceId);
    return ok(res, {
      ...parsed,
      provisioningState: "live_only",
      updatedAt: parsed.lastInformAt || new Date()
    });
  })
);

devicesRouter.post(
  "/sync-genie",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (req, res) => {
    const result = await syncCachedDevicesFromGenie({
      deviceId: req.body?.deviceId,
      limit: req.body?.limit || 50
    });
    return ok(res, result);
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
