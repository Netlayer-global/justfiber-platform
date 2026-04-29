import { genieacsClient } from "../integrations/genieacsClient.js";
import { DeviceOperationalCache } from "../models/DeviceOperationalCache.js";
import { DeviceOpticalSample } from "../models/DeviceOpticalSample.js";

const OPTICAL_REFRESH_OBJECTS = [
  "Device.Optical.Interface.",
  "Device.PON.Interface.",
  "Device.XPON.Interface.",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.",
  "InternetGatewayDevice.X_ALU-COM_GPON.",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.",
  "InternetGatewayDevice.X_DZS_GPON.",
  "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.",
  "InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.",
  "InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig."
];

const OPTICAL_PARAMETER_NAMES = [
  "InternetGatewayDevice.X_ALU_OntOpticalParam.RXPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.RxPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalRxPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.RxOpticalPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.ReceivedPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.TXPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.TxPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalTxPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.TxOpticalPower",
  "InternetGatewayDevice.X_ALU_OntOpticalParam.TransmitPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RXPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RxPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.OpticalRxPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RxOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.ReceivedPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.RXPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.RxPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.OpticalRxPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.RxOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.ReceivedPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.DownstreamPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.DownstreamOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.SignalLevel",
  "InternetGatewayDevice.X_ALU-COM_GPON.OpticalSignalLevel",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.RXPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.RxPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.OpticalRxPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.RxOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.ReceivedPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.DownstreamPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.DownstreamOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.SignalLevel",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.OpticalSignalLevel",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TXPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TxPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.OpticalTxPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TxOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TransmitPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.TXPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.TxPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.OpticalTxPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.TxOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.TransmitPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.UpstreamPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.UpstreamOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.TxLevel",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TXPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TxPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.OpticalTxPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TxOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TransmitPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.UpstreamPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.UpstreamOpticalPower",
  "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TxLevel",
  "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.TXPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RxPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.OpticalRxPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RxOpticalPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.ReceivedPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TXPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TxPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.OpticalTxPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TxOpticalPower",
  "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TransmitPower",
  "InternetGatewayDevice.X_DZS_GPON.RXPower",
  "InternetGatewayDevice.X_DZS_GPON.RxPower",
  "InternetGatewayDevice.X_DZS_GPON.OpticalRxPower",
  "InternetGatewayDevice.X_DZS_GPON.RxOpticalPower",
  "InternetGatewayDevice.X_DZS_GPON.OltRxPower",
  "InternetGatewayDevice.X_DZS_GPON.OntRxPower",
  "InternetGatewayDevice.X_DZS_GPON.TXPower",
  "InternetGatewayDevice.X_DZS_GPON.TxPower",
  "InternetGatewayDevice.X_DZS_GPON.OpticalTxPower",
  "InternetGatewayDevice.X_DZS_GPON.TxOpticalPower",
  "InternetGatewayDevice.X_DZS_GPON.OltTxPower",
  "InternetGatewayDevice.X_DZS_GPON.OntTxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.RxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.OpticalRxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.RxOpticalPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.TXPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.TxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.OpticalTxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.TxOpticalPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig.RXPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig.RxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig.OpticalRxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig.RxOpticalPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig.TXPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig.TxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig.OpticalTxPower",
  "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_DZS_WANGponLinkConfig.TxOpticalPower",
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

function collectMatchingPaths(root, predicate, basePath = "", acc = []) {
  if (!root || typeof root !== "object") return acc;
  for (const [key, value] of Object.entries(root)) {
    const nextPath = basePath ? `${basePath}.${key}` : key;
    if (predicate(nextPath, value)) {
      acc.push(nextPath);
    }
    if (value && typeof value === "object") {
      collectMatchingPaths(value, predicate, nextPath, acc);
    }
  }
  return acc;
}

function isLeafMetricValue(value) {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "object") {
    return "_value" in value || "value" in value;
  }
  return false;
}

function firstValue(root, paths) {
  for (const path of paths) {
    const value = readPath(root, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function hasOpticalShell(summary) {
  return Boolean(
    readPath(summary, "InternetGatewayDevice.X_ALU_OntOpticalParam") ||
    readPath(summary, "InternetGatewayDevice.X_ALU-COM_GPON") ||
    readPath(summary, "InternetGatewayDevice.X_ALU-COM_ONT.Optical") ||
    readPath(summary, "Device.Optical.Interface.1") ||
    readPath(summary, "Device.PON.Interface.1") ||
    readPath(summary, "Device.XPON.Interface.1")
  );
}

function buildSafeOpticalParameterNames(summary) {
  const names = new Set();

  if (readPath(summary, "InternetGatewayDevice.X_ALU_OntOpticalParam")) {
    [
      "InternetGatewayDevice.X_ALU_OntOpticalParam.RXPower",
      "InternetGatewayDevice.X_ALU_OntOpticalParam.TXPower",
      "InternetGatewayDevice.X_ALU_OntOpticalParam.Status"
    ].forEach((path) => names.add(path));
  }

  if (readPath(summary, "InternetGatewayDevice.X_ALU-COM_GPON")) {
    [
      "InternetGatewayDevice.X_ALU-COM_GPON.RXPower",
      "InternetGatewayDevice.X_ALU-COM_GPON.TXPower",
      "InternetGatewayDevice.X_ALU-COM_GPON.SignalLevel",
      "InternetGatewayDevice.X_ALU-COM_GPON.DownstreamPower",
      "InternetGatewayDevice.X_ALU-COM_GPON.UpstreamPower"
    ].forEach((path) => names.add(path));
  }

  if (readPath(summary, "InternetGatewayDevice.X_ALU-COM_GPON.Optical")) {
    [
      "InternetGatewayDevice.X_ALU-COM_GPON.Optical.RXPower",
      "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TXPower",
      "InternetGatewayDevice.X_ALU-COM_GPON.Optical.SignalLevel",
      "InternetGatewayDevice.X_ALU-COM_GPON.Optical.DownstreamPower",
      "InternetGatewayDevice.X_ALU-COM_GPON.Optical.UpstreamPower"
    ].forEach((path) => names.add(path));
  }

  if (readPath(summary, "InternetGatewayDevice.X_ALU-COM_ONT.Optical")) {
    [
      "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RXPower",
      "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TXPower",
      "InternetGatewayDevice.X_ALU-COM_ONT.Optical.SignalLevel",
      "InternetGatewayDevice.X_ALU-COM_ONT.Optical.DownstreamPower",
      "InternetGatewayDevice.X_ALU-COM_ONT.Optical.UpstreamPower"
    ].forEach((path) => names.add(path));
  }

  if (readPath(summary, "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig")) {
    [
      "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RXPower",
      "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TXPower",
      "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.SignalLevel",
      "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.DownstreamPower",
      "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.UpstreamPower"
    ].forEach((path) => names.add(path));
  }

  if (readPath(summary, "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig")) {
    [
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.RXPower",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.TXPower",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.SignalLevel",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.DownstreamPower",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.UpstreamPower"
    ].forEach((path) => names.add(path));
  }

  if (readPath(summary, "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig")) {
    [
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.RXPower",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.TXPower",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.SignalLevel",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.DownstreamPower",
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.UpstreamPower"
    ].forEach((path) => names.add(path));
  }

  return [...names];
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

function discoverOpticalMetric(summary, direction) {
  const normalizedDirection = String(direction || "").toLowerCase();
  const directionTokens =
    normalizedDirection === "tx"
      ? ["txpower", "txopticalpower", "opticaltxpower", "transmitpower", "olttxpower", "onttxpower", "pontxpower", "upstreampower", "upstreamopticalpower", "txlevel", "txdbm"]
      : ["rxpower", "rxopticalpower", "opticalrxpower", "receivedpower", "oltrxpower", "ontrxpower", "ponrxpower", "downstreampower", "downstreamopticalpower", "rxlevel", "signallevel", "opticalsignallevel", "signalstrength", "rxdbm"];
  const primaryHints = ["pon", "optical", "gpon", "xgpon", "wanpon", "ont", "dasan", "nokia", "alcl", "alcatel", "alu"];
  const excludedHints = ["wifi", "wlan", "radio", "ssid", "neighbor"];

  const matches = collectMatchingPaths(summary, (path, value) => {
    if (!isLeafMetricValue(value)) {
      return false;
    }
    const normalizedPath = String(path || "").toLowerCase();
    if (!directionTokens.some((token) => normalizedPath.includes(token))) {
      return false;
    }
    if (excludedHints.some((hint) => normalizedPath.includes(hint))) {
      return false;
    }
    return primaryHints.some((hint) => normalizedPath.includes(hint));
  });

  for (const path of matches) {
    const value = readPath(summary, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  const fallbackMatches = collectMatchingPaths(summary, (path, value) => {
    if (!isLeafMetricValue(value)) {
      return false;
    }
    const normalizedPath = String(path || "").toLowerCase();
    return directionTokens.some((token) => normalizedPath.includes(token)) &&
      !excludedHints.some((hint) => normalizedPath.includes(hint));
  });

  for (const path of fallbackMatches) {
    const value = readPath(summary, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
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

async function recordOpticalSample(cacheRecord, parsed, source = "genie_sync") {
  const rxPower = Number(parsed?.opticalInfo?.rxPower);
  const txPower = Number(parsed?.opticalInfo?.txPower);
  const hasRx = Number.isFinite(rxPower);
  const hasTx = Number.isFinite(txPower);
  if (!hasRx && !hasTx) return;

  const measuredAt = parsed?.lastInformAt || new Date();
  const healthStatus =
    hasRx ? (rxPower > -21 ? "good" : rxPower > -27 ? "warning" : "critical") : "unknown";

  await DeviceOpticalSample.create({
    deviceId: cacheRecord.deviceId,
    customerId: cacheRecord.customerId,
    serviceId: cacheRecord.serviceId,
    serialNumber: parsed?.serialNumber || cacheRecord.serialNumber || "",
    productClass: parsed?.productClass || cacheRecord.productClass || "",
    measuredAt,
    rxPower: hasRx ? rxPower : null,
    txPower: hasTx ? txPower : null,
    healthStatus,
    source,
  });
}

async function requestOpticalTelemetryRefresh(deviceId, summary = null) {
  if (!deviceId) return;

  for (const objectName of OPTICAL_REFRESH_OBJECTS) {
    const normalizedObjectName = String(objectName || "").trim();

    try {
      await genieacsClient.runTask(deviceId, {
        name: "refreshObject",
        objectName: normalizedObjectName
      }, { connectionRequest: true });
    } catch {
      // Ignore individual task failures; some models reject unsupported objects.
    }
  }

  const parameterNames = buildSafeOpticalParameterNames(summary);
  if (parameterNames.length > 0) {
    try {
      await genieacsClient.runTask(deviceId, {
        name: "getParameterValues",
        parameterNames
      }, { connectionRequest: true });
    } catch {
      // Ignore targeted value fetch failures and fall back to what the device already exposes.
    }
  }

  await wait(3200);
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
    "Device.Optical.Interface.1.RXPower",
    "Device.Optical.Interface.1.RxPower",
    "Device.Optical.Interface.1.OpticalRxPower",
    "Device.Optical.Interface.1.ReceivedPower",
    "Device.Optical.Interface.1.DownstreamPower",
    "Device.Optical.Interface.1.DownstreamOpticalPower",
    "Device.Optical.Interface.1.SignalLevel",
    "Device.Optical.Interface.1.OpticalSignalLevel",
    "Device.Optical.Interface.1.SignalStrength",
    "Device.Optical.Interface.1.RxLevel",
    "Device.PON.Interface.1.RXPower",
    "Device.PON.Interface.1.RxPower",
    "Device.PON.Interface.1.OpticalRxPower",
    "Device.PON.Interface.1.DownstreamPower",
    "Device.PON.Interface.1.DownstreamOpticalPower",
    "Device.PON.Interface.1.SignalLevel",
    "Device.PON.Interface.1.OpticalSignalLevel",
    "Device.XPON.Interface.1.RXPower",
    "Device.XPON.Interface.1.RxPower",
    "Device.XPON.Interface.1.OpticalRxPower",
    "Device.XPON.Interface.1.DownstreamPower",
    "Device.XPON.Interface.1.DownstreamOpticalPower",
    "Device.XPON.Interface.1.SignalLevel",
    "Device.XPON.Interface.1.OpticalSignalLevel",
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.DownstreamPower",
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.DownstreamOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.SignalLevel",
    "InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.RxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.OpticalRxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.RxOpticalPower",
    "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.X_HW_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.X_DASAN_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.X_DASAN_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.X_DASAN_OPTICAL.RXPower",
    "InternetGatewayDevice.X_DZS_GPON.RXPower",
    "InternetGatewayDevice.X_DZS_GPON.RxPower",
    "InternetGatewayDevice.X_DZS_GPON.OpticalRxPower",
    "InternetGatewayDevice.X_DZS_GPON.RxOpticalPower",
    "InternetGatewayDevice.X_DZS_GPON.OltRxPower",
    "InternetGatewayDevice.X_DZS_GPON.OntRxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.RXPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.RxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.OpticalRxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.RxOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.ReceivedPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.DownstreamPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.DownstreamOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.SignalLevel",
    "InternetGatewayDevice.X_ALU-COM_GPON.OpticalSignalLevel",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.RXPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.RxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.OpticalRxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.RxOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.ReceivedPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.DownstreamPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.DownstreamOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.SignalLevel",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.OpticalSignalLevel",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RxPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.OpticalRxPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.RxOpticalPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.ReceivedPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.DownstreamPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.DownstreamOpticalPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.SignalLevel",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.OpticalSignalLevel",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.RxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.OpticalRxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.RxOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.ReceivedPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.DownstreamPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.DownstreamOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.SignalLevel",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.RXPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.RxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.OpticalRxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.RxOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.ReceivedPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.DownstreamPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.DownstreamOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.SignalLevel",
    "InternetGatewayDevice.X_ZTE-COM_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.X_HW_WANPONInterfaceConfig.RXPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RXPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RxPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.OpticalRxPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.RxOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.ReceivedPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.DownstreamPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.DownstreamOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.SignalLevel",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.OpticalSignalLevel",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.RXPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.RxPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalRxPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.RxOpticalPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.ReceivedPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.DownstreamPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.DownstreamOpticalPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.SignalLevel",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalSignalLevel",
    "InternetGatewayDevice.FAP.Tunnel.1.Stats.RXPower",
    "VirtualParameters.RXPower",
    "VirtualParameters.OpticalRxPower"
  ]) ?? discoverOpticalMetric(summary, "rx");
  const txPower = firstValue(summary, [
    "Device.Optical.Interface.1.TXPower",
    "Device.Optical.Interface.1.TxPower",
    "Device.Optical.Interface.1.OpticalTxPower",
    "Device.Optical.Interface.1.TransmitPower",
    "Device.Optical.Interface.1.UpstreamPower",
    "Device.Optical.Interface.1.UpstreamOpticalPower",
    "Device.Optical.Interface.1.SignalStrength",
    "Device.Optical.Interface.1.TxLevel",
    "Device.PON.Interface.1.TXPower",
    "Device.PON.Interface.1.TxPower",
    "Device.PON.Interface.1.OpticalTxPower",
    "Device.PON.Interface.1.UpstreamPower",
    "Device.PON.Interface.1.UpstreamOpticalPower",
    "Device.PON.Interface.1.TxLevel",
    "Device.XPON.Interface.1.TXPower",
    "Device.XPON.Interface.1.TxPower",
    "Device.XPON.Interface.1.OpticalTxPower",
    "Device.XPON.Interface.1.UpstreamPower",
    "Device.XPON.Interface.1.UpstreamOpticalPower",
    "Device.XPON.Interface.1.TxLevel",
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.UpstreamPower",
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.UpstreamOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.TxLevel",
    "InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.TxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.OpticalTxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_DZS_WANGponLinkConfig.TxOpticalPower",
    "InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.X_HW_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.X_DASAN_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.X_DASAN_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.X_DASAN_OPTICAL.TXPower",
    "InternetGatewayDevice.X_DZS_GPON.TXPower",
    "InternetGatewayDevice.X_DZS_GPON.TxPower",
    "InternetGatewayDevice.X_DZS_GPON.OpticalTxPower",
    "InternetGatewayDevice.X_DZS_GPON.TxOpticalPower",
    "InternetGatewayDevice.X_DZS_GPON.OltTxPower",
    "InternetGatewayDevice.X_DZS_GPON.OntTxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.TXPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.TxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.OpticalTxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.TxOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.TransmitPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.UpstreamPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.UpstreamOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.TxLevel",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TXPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.OpticalTxPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TxOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TransmitPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.UpstreamPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.UpstreamOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_GPON.Optical.TxLevel",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TxPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.OpticalTxPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TxOpticalPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TransmitPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.UpstreamPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.UpstreamOpticalPower",
    "InternetGatewayDevice.WANDevice.1.X_ALU-COM_WANPONInterfaceConfig.TxLevel",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.TxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.OpticalTxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.TxOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.TransmitPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.UpstreamPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.UpstreamOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_ALU-COM_WANGponLinkConfig.TxLevel",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.TXPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.TxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.OpticalTxPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.TxOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.TransmitPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.UpstreamPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.UpstreamOpticalPower",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.7.X_ALU-COM_WANGponLinkConfig.TxLevel",
    "InternetGatewayDevice.X_ZTE-COM_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.X_HW_WANPONInterfaceConfig.TXPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TXPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TxPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.OpticalTxPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TxOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TransmitPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.UpstreamPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.UpstreamOpticalPower",
    "InternetGatewayDevice.X_ALU-COM_ONT.Optical.TxLevel",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.TXPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.TxPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.OpticalTxPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.TxOpticalPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.TransmitPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.UpstreamPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.UpstreamOpticalPower",
    "InternetGatewayDevice.X_ALU_OntOpticalParam.TxLevel",
    "InternetGatewayDevice.FAP.Tunnel.1.Stats.TXPower",
    "VirtualParameters.TXPower",
    "VirtualParameters.OpticalTxPower"
  ]) ?? discoverOpticalMetric(summary, "tx");
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
      try {
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
      } catch (error) {
        console.error("[devices] Failed to summarize live device:", error);
        return null;
      }
    })
    .filter((device) => device?.deviceId);

  return Promise.all(
    baseItems.map(async (device) => {
      if (device.opticalInfo?.rxPower != null || device.opticalInfo?.txPower != null) {
        return device;
      }

      try {
        const richSummary = await genieacsClient.getRichDeviceSummary({
          deviceId: device.deviceId,
          serialNumber: device.serialNumber
        });
        if (!richSummary) {
          return device;
        }

        let parsed = summarizeGenieDevice(richSummary, device.deviceId);
        if (parsed.opticalInfo?.rxPower == null && parsed.opticalInfo?.txPower == null && hasOpticalShell(richSummary)) {
          await requestOpticalTelemetryRefresh(device.deviceId, richSummary);
          const retriedSummary = await genieacsClient.getRichDeviceSummary({
            deviceId: device.deviceId,
            serialNumber: device.serialNumber
          });
          if (retriedSummary) {
            parsed = summarizeGenieDevice(retriedSummary, device.deviceId);
          }
        }
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
      } catch (error) {
        console.error("[devices] Failed to enrich live device summary:", device.deviceId, error);
        return device;
      }
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
    await requestOpticalTelemetryRefresh(cacheRecord.deviceId, summary);
    summary = await genieacsClient.getRichDeviceSummary({
      deviceId: cacheRecord.deviceId,
      serialNumber: cacheRecord.serialNumber
    });
    if (summary) {
      parsed = summarizeGenieDevice(summary, cacheRecord.deviceId);
    }
    if (summary && parsed.opticalInfo?.rxPower == null && parsed.opticalInfo?.txPower == null && hasOpticalShell(summary)) {
      await requestOpticalTelemetryRefresh(cacheRecord.deviceId, summary);
      summary = await genieacsClient.getRichDeviceSummary({
        deviceId: cacheRecord.deviceId,
        serialNumber: cacheRecord.serialNumber
      });
      if (summary) {
        parsed = summarizeGenieDevice(summary, cacheRecord.deviceId);
      }
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

  try {
    await recordOpticalSample(cacheRecord, parsed, "genie_sync");
  } catch (error) {
    console.error("[devices] Failed to store optical sample:", cacheRecord.deviceId, error);
  }

  return { ok: true, deviceId: cacheRecord.deviceId, onlineStatus: parsed.onlineStatus };
}

async function seedMissingDevicesFromGenie(limit = 50) {
  const liveDevices = await genieacsClient.listDevices(Math.max(1, Math.min(Number(limit || 50), 200)));
  if (!Array.isArray(liveDevices) || !liveDevices.length) {
    return { seeded: 0 };
  }

  let seeded = 0;
  for (const summary of liveDevices) {
    const parsed = summarizeGenieDevice(summary, firstValue(summary, ["_id", "DeviceID.ID"]));
    if (!parsed.deviceId) continue;
    const existing = await DeviceOperationalCache.findOne({ deviceId: parsed.deviceId }).select({ _id: 1 }).lean();
    if (existing) continue;

    await DeviceOperationalCache.create({
      deviceId: parsed.deviceId,
      serialNumber: parsed.serialNumber || "",
      productClass: parsed.productClass || "",
      onlineStatus: parsed.onlineStatus || "unknown",
      wanInfo: parsed.wanInfo || {},
      wifiInfo: parsed.wifiInfo || {},
      lanInfo: parsed.lanInfo || {},
      opticalInfo: parsed.opticalInfo || {},
      provisioningState: "discovered_from_genie",
      updatedAt: parsed.lastInformAt || new Date(),
      ...(parsed.lastInformAt ? { lastInformAt: parsed.lastInformAt } : {})
    });
    seeded += 1;
  }

  return { seeded };
}

export async function syncCachedDevicesFromGenie({ deviceId, limit = 50 } = {}) {
  let seeded = 0;
  if (!deviceId) {
    try {
      const seedResult = await seedMissingDevicesFromGenie(limit);
      seeded = seedResult.seeded || 0;
    } catch (error) {
      console.error("[devices] Failed to seed missing Genie devices:", error);
    }
  }

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
    seeded,
    synced,
    failed,
    results
  };
}
