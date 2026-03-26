import { genieacsClient } from "../integrations/genieacsClient.js";
import { DeviceOperationalCache } from "../models/DeviceOperationalCache.js";

function readValue(node) {
  if (node === undefined || node === null) return undefined;
  if (typeof node === "object" && "_value" in node) return node._value;
  return node;
}

function readPath(root, path) {
  const parts = Array.isArray(path) ? path : String(path || "").split(".");
  let current = root;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return readValue(current);
}

function firstValue(root, paths) {
  for (const path of paths) {
    const value = readPath(root, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveOnlineStatus(lastInformAt) {
  if (!lastInformAt) return "unknown";
  const ageMs = Date.now() - lastInformAt.getTime();
  return ageMs <= 1000 * 60 * 15 ? "online" : "offline";
}

export function summarizeGenieDevice(summary, fallbackDeviceId) {
  const lastInformAt =
    parseDate(summary?._lastInform) ||
    parseDate(readPath(summary, "_lastInform._value")) ||
    parseDate(firstValue(summary, [
      "InternetGatewayDevice.DeviceInfo.UpTime._timestamp",
      "InternetGatewayDevice.DeviceSummary._timestamp"
    ]));

  const ssid24 = firstValue(summary, [
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID"
  ]);
  const ssid5 = firstValue(summary, [
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.SSID"
  ]);
  const wifiPassword24 = firstValue(summary, [
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase"
  ]);
  const wifiPassword5 = firstValue(summary, [
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.PreSharedKey.1.KeyPassphrase"
  ]);
  const pppoeUsername = firstValue(summary, [
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Username"
  ]);
  const vlanId = firstValue(summary, [
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ALU-COM_VLANIDMark",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_ALU-COM_VLANIDMark"
  ]);
  const externalIp = firstValue(summary, [
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress"
  ]);
  const rxPower = firstValue(summary, [
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.X_HW_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.X_ZTE-COM_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.X_HW_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RXPower",
    "InternetGatewayDevice.FAP.Tunnel.1.Stats.RXPower",
    "VirtualParameters.RXPower",
    "VirtualParameters.OpticalRxPower"
  ]);
  const txPower = firstValue(summary, [
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.X_HW_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.X_ZTE-COM_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.X_HW_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TXPower",
    "InternetGatewayDevice.FAP.Tunnel.1.Stats.TXPower",
    "VirtualParameters.TXPower",
    "VirtualParameters.OpticalTxPower"
  ]);
  const serialNumber = firstValue(summary, [
    "DeviceID.SerialNumber",
    "InternetGatewayDevice.DeviceInfo.SerialNumber"
  ]);
  const productClass = firstValue(summary, [
    "DeviceID.ProductClass",
    "InternetGatewayDevice.DeviceInfo.ProductClass"
  ]);

  return {
    deviceId: String(firstValue(summary, ["_id", "DeviceID.ID"]) || fallbackDeviceId || ""),
    serialNumber: serialNumber ? String(serialNumber) : undefined,
    productClass: productClass ? String(productClass) : undefined,
    lastInformAt,
    onlineStatus: deriveOnlineStatus(lastInformAt),
    wanInfo: {
      ipAddress: externalIp || null,
      vlanId: vlanId ?? null,
      pppoeUsernameMasked: pppoeUsername || null
    },
    wifiInfo: {
      ssid24Masked: ssid24 || null,
      ssid5Masked: ssid5 || null,
      password24Masked: wifiPassword24 ? "********" : null,
      password5Masked: wifiPassword5 ? "********" : null
    },
    opticalInfo: {
      rxPower: rxPower ?? null,
      txPower: txPower ?? null
    }
  };
}

export async function getLiveGenieDeviceList(limit = 100) {
  const liveDevices = await genieacsClient.listDevices(limit);
  if (!Array.isArray(liveDevices)) return [];

  const cacheRecords = await DeviceOperationalCache.find({
    deviceId: {
      $in: liveDevices.map((device) => String(firstValue(device, ["_id", "DeviceID.ID"]) || "")).filter(Boolean)
    }
  }).lean();
  const cacheByDeviceId = new Map(cacheRecords.map((record) => [record.deviceId, record]));

  return liveDevices
    .map((device) => {
      const parsed = summarizeGenieDevice(device, undefined);
      const cached = cacheByDeviceId.get(parsed.deviceId);
      return {
        ...(cached || {}),
        ...parsed,
        customerId: cached?.customerId || null,
        serviceId: cached?.serviceId || null,
        provisioningState: cached?.provisioningState || "live_only",
        wanInfo: {
          ...(cached?.wanInfo || {}),
          ...(parsed.wanInfo || {})
        },
        wifiInfo: {
          ...(cached?.wifiInfo || {}),
          ...(parsed.wifiInfo || {})
        },
        opticalInfo: {
          ...(cached?.opticalInfo || {}),
          ...(parsed.opticalInfo || {})
        },
        updatedAt: cached?.updatedAt || parsed.lastInformAt || new Date()
      };
    })
    .filter((device) => device.deviceId);
}

export async function syncDeviceFromGenie(cacheRecord) {
  if (!cacheRecord?.deviceId) {
    return { ok: false, reason: "missing_device_id" };
  }

  const summary = await genieacsClient.getDeviceSummary(cacheRecord.deviceId);
  if (!summary) {
    return { ok: false, reason: "not_found" };
  }

  const parsed = summarizeGenieDevice(summary, cacheRecord.deviceId);
  await DeviceOperationalCache.updateOne(
    { _id: cacheRecord._id },
    {
      $set: {
        ...(parsed.serialNumber ? { serialNumber: parsed.serialNumber } : {}),
        ...(parsed.productClass ? { productClass: parsed.productClass } : {}),
        ...(parsed.lastInformAt ? { lastInformAt: parsed.lastInformAt } : {}),
        onlineStatus: parsed.onlineStatus,
        wanInfo: {
          ...(cacheRecord.wanInfo || {}),
          ...(parsed.wanInfo || {})
        },
        wifiInfo: {
          ...(cacheRecord.wifiInfo || {}),
          ...(parsed.wifiInfo || {})
        },
        opticalInfo: {
          ...(cacheRecord.opticalInfo || {}),
          ...(parsed.opticalInfo || {})
        }
      }
    }
  );

  return { ok: true, deviceId: cacheRecord.deviceId, onlineStatus: parsed.onlineStatus };
}

export async function syncCachedDevicesFromGenie({ deviceId, limit = 50 } = {}) {
  const filter = deviceId ? { deviceId } : {};
  const devices = await DeviceOperationalCache.find(filter)
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit || 50), 200)));

  let synced = 0;
  let failed = 0;
  const results = [];

  for (const device of devices) {
    try {
      const result = await syncDeviceFromGenie(device);
      if (result.ok) synced += 1;
      else failed += 1;
      results.push({ deviceId: device.deviceId, ...result });
    } catch (error) {
      failed += 1;
      results.push({
        deviceId: device.deviceId,
        ok: false,
        reason: error.message
      });
    }
  }

  return {
    scanned: devices.length,
    synced,
    failed,
    results
  };
}
