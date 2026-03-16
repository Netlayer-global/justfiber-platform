import { env } from "../config/env.js";

const DEVICE_ID = process.env.INSPECT_GENIE_DEVICE_ID;

function buildHeaders() {
  const headers = {};
  if (env.GENIEACS_JWT) {
    headers.Authorization = `Bearer ${env.GENIEACS_JWT}`;
  } else if (env.GENIEACS_USERNAME && env.GENIEACS_PASSWORD) {
    const basic = Buffer.from(`${env.GENIEACS_USERNAME}:${env.GENIEACS_PASSWORD}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }
  return headers;
}

function getByPath(root, path) {
  return path.split(".").reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), root);
}

function extractValue(root, path) {
  const node = getByPath(root, path);
  if (!node) return null;
  if (node && typeof node === "object" && "_value" in node) {
    return node._value;
  }
  return node;
}

async function main() {
  if (!DEVICE_ID) {
    throw new Error("Missing INSPECT_GENIE_DEVICE_ID");
  }
  if (env.MOCK_EXTERNALS) {
    throw new Error("MOCK_EXTERNALS=true. Set MOCK_EXTERNALS=false before live GenieACS inspection.");
  }

  const response = await fetch(new URL(`/devices/${encodeURIComponent(DEVICE_ID)}`, env.GENIEACS_URL), {
    headers: buildHeaders()
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch GenieACS device: ${response.status} ${text}`);
  }
  const payload = await response.json();

  const candidatePaths = [
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey",
    "Device.WiFi.SSID.1.SSID",
    "Device.WiFi.AccessPoint.1.Security.KeyPassphrase",
    "Device.WiFi.AccessPoint.1.Security.PreSharedKey.1.KeyPassphrase",
    "Device.WiFi.AccessPoint.1.Security.PreSharedKey.1.PreSharedKey",
    "Device.WiFi.SSID.5.SSID",
    "Device.WiFi.AccessPoint.5.Security.KeyPassphrase",
    "Device.WiFi.AccessPoint.5.Security.PreSharedKey.1.KeyPassphrase",
    "Device.WiFi.AccessPoint.5.Security.PreSharedKey.1.PreSharedKey"
  ];

  const rows = candidatePaths.map((path) => ({
    path,
    value: extractValue(payload, path)
  }));

  console.log(JSON.stringify({
    deviceId: payload._id,
    serialNumber: payload?._deviceId?._SerialNumber,
    productClass: payload?._deviceId?._ProductClass,
    wifi: rows
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
