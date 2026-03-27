function buildWlanBase(index) {
  return `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${index}`;
}

function buildDeviceSsidBase(index) {
  return `Device.WiFi.SSID.${index}`;
}

function buildDeviceAccessPointBase(index) {
  return `Device.WiFi.AccessPoint.${index}.Security`;
}

export const NOKIA_WIFI_SLOTS = {
  ssid24: [1, 5],
  ssid5: [2, 6]
};

export function buildNokiaSsidPaths(kind) {
  return (NOKIA_WIFI_SLOTS[kind] || []).map((index) => `${buildWlanBase(index)}.SSID`);
}

export function buildNokiaPasswordPaths(kind) {
  return (NOKIA_WIFI_SLOTS[kind] || []).flatMap((index) => [
    `${buildWlanBase(index)}.KeyPassphrase`,
    `${buildWlanBase(index)}.PreSharedKey.1.KeyPassphrase`
  ]);
}

export function buildNokiaEnablePaths() {
  return [...NOKIA_WIFI_SLOTS.ssid24, ...NOKIA_WIFI_SLOTS.ssid5].map((index) => `${buildWlanBase(index)}.Enable`);
}

export function buildNokiaInspectPaths() {
  const wlanPaths = [...NOKIA_WIFI_SLOTS.ssid24, ...NOKIA_WIFI_SLOTS.ssid5].flatMap((index) => [
    `${buildWlanBase(index)}.SSID`,
    `${buildWlanBase(index)}.KeyPassphrase`,
    `${buildWlanBase(index)}.PreSharedKey.1.KeyPassphrase`,
    `${buildWlanBase(index)}.PreSharedKey.1.PreSharedKey`,
    `${buildWlanBase(index)}.Enable`
  ]);
  const devicePaths = [1, 5].flatMap((index) => [
    `${buildDeviceSsidBase(index)}.SSID`,
    `${buildDeviceAccessPointBase(index)}.KeyPassphrase`,
    `${buildDeviceAccessPointBase(index)}.PreSharedKey.1.KeyPassphrase`,
    `${buildDeviceAccessPointBase(index)}.PreSharedKey.1.PreSharedKey`
  ]);
  return [...wlanPaths, ...devicePaths];
}

export function listNokiaWlanSlots() {
  return [...NOKIA_WIFI_SLOTS.ssid24, ...NOKIA_WIFI_SLOTS.ssid5];
}

export function getNokiaSlotBand(index) {
  return NOKIA_WIFI_SLOTS.ssid24.includes(index) ? "2.4G" : "5G";
}

export function isUnifiedNokiaWifiRequest({ brand, ssid24, ssid5, password24, password5 }) {
  return String(brand || "").toLowerCase() === "nokia" &&
    typeof ssid24 === "string" &&
    typeof ssid5 === "string" &&
    typeof password24 === "string" &&
    typeof password5 === "string" &&
    ssid24.trim() !== "" &&
    ssid24.trim() === ssid5.trim() &&
    password24.trim() !== "" &&
    password24.trim() === password5.trim();
}
