import { genieacsClient } from "../integrations/genieacsClient.js";
import { DeviceOperationalCache } from "../models/DeviceOperationalCache.js";

const OPTICAL_REFRESH_OBJECTS = [
  "InternetGatewayDevice.X_ALU_OntOpticalParam.",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.",
  "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.",
  "InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig."
];

const OPTICAL_PARAMETER_NAMES = [
  "InternetGatewayDevice.X_ALU_OntOpticalParam.RXPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.RxPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalRxPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.RxOpticalPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.TXPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.TxPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalTxPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.TxOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RXPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TXPower",
  "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.TXPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TXPower",
  "VirtualParameters.RXPower",
  "VirtualParameters.TXPower",
  "VirtualParameters.OpticalRxPower",
  "VirtualParameters.OpticalTxPower"
];

function readValue(node) {
  if (node === undefined || node === null) return undefined;
  if (typeof node === "object" && "_value" in node) return node._value;
  return node;
}

function extractNodeValue(node) {
  return readValue(node);
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

function collectHostNodes(node) {
  if (!node || typeof node !== "object") return [];
  const hostsRoot =
    node?.InternetGatewayDevice?.LANDevice?.["1"]?.Hosts?.Host ||
    node?.InternetGatewayDevice?.LANDevice?.["1"]?.Hosts?.Hosts ||
    node?.Device?.Hosts?.Host ||
    null;
  if (!hostsRoot || typeof hostsRoot !== "object") return [];
  return Object.entries(hostsRoot)
    .filter(([key, value]) => key !== "_object" && value && typeof value === "object")
    .map(([, value]) => value);
}

function summarizeLanHosts(summary) {
  const hosts = collectHostNodes(summary)
    .map((hostNode, index) => {
      const hostName = extractHostNodeValue(hostNode, ["HostName", "Name", "FriendlyName"]);
      const macAddress = extractHostNodeValue(hostNode, ["MACAddress", "PhysAddress"]);
      const ipAddress = extractHostNodeValue(hostNode, ["IPAddress", "IPV4Address.1.IPAddress", "IPV6Address.1.IPAddress"]);
      const interfaceType = extractHostNodeValue(hostNode, ["InterfaceType", "Layer1Interface"]);
      const active = extractHostNodeValue(hostNode, ["Active", "PresenceActive"]);
      const addressSource = extractHostNodeValue(hostNode, ["AddressSource"]);
      if (!hostName && !macAddress && !ipAddress) {
        return null;
      }
      return {
        clientId: String(macAddress || hostName || ipAddress || `host-${index + 1}`),
        hostName: String(hostName || macAddress || ipAddress || `Connected Device ${index + 1}`),
        macAddress: macAddress ? String(macAddress) : "",
        ipAddress: ipAddress ? String(ipAddress) : "",
        interfaceType: interfaceType ? String(interfaceType) : "wifi",
        active: active === undefined || active === null ? true : Boolean(active),
        addressSource: addressSource ? String(addressSource) : ""
      };
    })
    .filter(Boolean);
  return hosts;
}

function extractHostNodeValue(hostNode, names) {
  for (const name of names) {
    const value = extractNodeValue(hostNode?.[name]);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOpticalTelemetryRefresh(deviceId) {
  if (!deviceId) return;

  for (const objectName of OPTICAL_REFRESH_OBJECTS) {
    try {
      await genieacsClient.runTask(deviceId, {
        name: "refreshObject",
        objectName
      }, { connectionRequest: true });
    } catch {
      // Ignore individual task failures; some models reject unsupported objects.
    }
  }

  try {
    await genieacsClient.runTask(deviceId, {
      name: "getParameterValues",
      parameterNames: OPTICAL_PARAMETER_NAMES
    }, { connectionRequest: true });
  } catch {
    // Ignore explicit parameter fetch failures and fall back to whatever the device exposes.
  }

  await wait(1500);
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
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID",
    "Device.WiFi.SSID.1.SSID",
    "Device.WiFi.SSID.5.SSID"
  ]);
  const ssid5 = firstValue(summary, [
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.SSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID",
    "Device.WiFi.SSID.5.SSID"
  ]);
  const wifiPassword24 = firstValue(summary, [
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey",
    "Device.WiFi.AccessPoint.1.Security.KeyPassphrase",
    "Device.WiFi.AccessPoint.1.Security.PreSharedKey.1.KeyPassphrase",
    "Device.WiFi.AccessPoint.5.Security.KeyPassphrase"
  ]);
  const wifiPassword5 = firstValue(summary, [
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.PreSharedKey.1.PreSharedKey",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.PreSharedKey.1.PreSharedKey",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey",
    "Device.WiFi.AccessPoint.5.Security.KeyPassphrase",
    "Device.WiFi.AccessPoint.5.Security.PreSharedKey.1.KeyPassphrase"
  ]);
  const pppoeUsername = firstValue(summary, [
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.2.Username",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Username",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.2.Username",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.Username",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection.1.Username",
    "Device.PPP.Interface.1.Username",
    "Device.PPP.Interface.2.Username",
    "Device.WAN.PPPConnection.1.Username",
    "Device.WAN.PPPConnection.2.Username"
  ]);
  const vlanId = firstValue(summary, [
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ALU-COM_VLANIDMark",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_ALU-COM_VLANIDMark",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ALU_OntWAN.VlanId",
    "Device.WAN.Ethernet.1.VLANID"
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
    "InternetGatewayDevice.X_ALU_OntOpticalParam.RXPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.RxPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalRxPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.RxOpticalPower",
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
    "InternetGatewayDevice.X_ALU_OntOpticalParam.TXPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.TxPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalTxPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.TxOpticalPower",
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
  const lanHosts = summarizeLanHosts(summary);
  const leasedClients = firstValue(summary, [
    "InternetGatewayDevice.LANDevice.1.Hosts.HostNumberOfEntries",
    "Device.Hosts.HostNumberOfEntries"
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
    lanInfo: {
      leasedClients: Number(leasedClients || lanHosts.length || 0),
      hosts: lanHosts
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

  const baseItems = liveDevices
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
        lanInfo: {
          ...(cached?.lanInfo || {}),
          ...(parsed.lanInfo || {})
        },
        opticalInfo: {
          ...(cached?.opticalInfo || {}),
          ...(parsed.opticalInfo || {})
        },
        updatedAt: cached?.updatedAt || parsed.lastInformAt || new Date()
      };
    })
    .filter((device) => device.deviceId);

  return Promise.all(
    baseItems.map(async (device) => {
      if (device.opticalInfo?.rxPower != null || device.opticalInfo?.txPower != null) {
        return device;
      }

      const richSummary = await genieacsClient.getRichDeviceSummary({
        deviceId: device.deviceId,
        serialNumber: device.serialNumber
      });
      if (!richSummary) {
        return device;
      }

      const parsed = summarizeGenieDevice(richSummary, device.deviceId);
      return {
        ...device,
        ...(parsed.serialNumber ? { serialNumber: parsed.serialNumber } : {}),
        ...(parsed.productClass ? { productClass: parsed.productClass } : {}),
        onlineStatus: parsed.onlineStatus || device.onlineStatus,
        wanInfo: {
          ...(device.wanInfo || {}),
          ...(parsed.wanInfo || {})
        },
        wifiInfo: {
          ...(device.wifiInfo || {}),
          ...(parsed.wifiInfo || {})
        },
        lanInfo: {
          ...(device.lanInfo || {}),
          ...(parsed.lanInfo || {})
        },
        opticalInfo: {
          ...(device.opticalInfo || {}),
          ...(parsed.opticalInfo || {})
        },
        updatedAt: parsed.lastInformAt || device.updatedAt
      };
    })
  );
}

export async function syncDeviceFromGenie(cacheRecord) {
  if (!cacheRecord?.deviceId) {
    return { ok: false, reason: "missing_device_id" };
  }

  let summary = await genieacsClient.getRichDeviceSummary({
    deviceId: cacheRecord.deviceId,
    serialNumber: cacheRecord.serialNumber
  });
  if (!summary) {
    return { ok: false, reason: "not_found" };
  }

  let parsed = summarizeGenieDevice(summary, cacheRecord.deviceId);
  if (parsed.opticalInfo?.rxPower == null && parsed.opticalInfo?.txPower == null) {
    await requestOpticalTelemetryRefresh(cacheRecord.deviceId);
    summary = await genieacsClient.getRichDeviceSummary({
      deviceId: cacheRecord.deviceId,
      serialNumber: cacheRecord.serialNumber
    });
    if (summary) {
      parsed = summarizeGenieDevice(summary, cacheRecord.deviceId);
    }
  }
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
        lanInfo: {
          ...(cacheRecord.lanInfo || {}),
          ...(parsed.lanInfo || {})
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
