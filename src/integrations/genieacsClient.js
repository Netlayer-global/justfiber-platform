import { env } from "../config/env.js";
import { resolveProvisioningProfile } from "../common/networkProvisioning.js";
import {
  buildNokiaEnablePaths,
  buildNokiaGuestEnablePaths,
  buildNokiaGuestPasswordPaths,
  buildNokiaGuestSsidPaths,
  getNokiaSlotBand,
  isUnifiedNokiaWifiRequest,
  listNokiaWlanSlots,
  normalizeWifiEnableValue
} from "../common/nokiaWifi.js";

const allowedPresets = new Set([
  "SERVICE_PREPARE",
  "SERVICE_ACTIVATE",
  "SERVICE_SUSPEND",
  "SERVICE_RESUME",
  "SERVICE_RETRY",
  "DEVICE_REPLACE_ACTIVATE"
]);

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

async function genieacsRequest(method, path, body) {
  const url = new URL(path, env.GENIEACS_URL).toString();

  if (env.MOCK_EXTERNALS) {
    return { ok: true, mock: true, method, url, body };
  }

  const response = await fetch(url, {
    method,
    headers: {
      ...buildHeaders(),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`GenieACS request failed: ${method} ${url} -> ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function findDeviceByQuery(query) {
  const encoded = encodeURIComponent(JSON.stringify(query));
  const result = await genieacsRequest("GET", `/devices?query=${encoded}`);
  if (Array.isArray(result)) {
    return result[0] || null;
  }
  return null;
}

function deviceIdVariants(deviceId) {
  const raw = String(deviceId || "").trim();
  if (!raw) return [];
  const variants = new Set([raw]);

  try {
    variants.add(decodeURIComponent(raw));
  } catch {}

  try {
    variants.add(encodeURIComponent(raw));
  } catch {}

  for (const value of [...variants]) {
    if (value.includes("%2D")) {
      variants.add(value.replace(/%2D/gi, "-"));
    }
    if (value.includes("-")) {
      variants.add(value.replace(/-/g, "%2D"));
    }
  }

  return [...variants].filter(Boolean);
}

function readNodeAtPath(root, path) {
  const parts = String(path || "").split(".");
  let current = root;
  for (const part of parts) {
    if (current === undefined || current === null || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function extractNodeValue(node) {
  if (!node) return null;
  if (typeof node === "object" && "_value" in node) {
    return node._value;
  }
  return node;
}

function pathExistsInSummary(summary, path) {
  return readNodeAtPath(summary, path) !== undefined;
}

function isWritableParameterNode(node) {
  if (!node || typeof node !== "object") return true;
  if ("_object" in node && node._object === true && !("_value" in node)) return false;
  if ("_writable" in node) return node._writable !== false;
  return true;
}

function selectExistingPaths(summary, pathOrPaths) {
  const paths = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths];
  if (!summary) return paths.filter(Boolean);
  const matched = paths.filter((path) => {
    const normalizedPath = String(path || "").split("|")[0];
    return normalizedPath && pathExistsInSummary(summary, normalizedPath);
  });
  return matched.length ? matched : paths.filter(Boolean).slice(0, 1);
}

function isUsableDeviceSummary(summary) {
  return Boolean(
    summary &&
      typeof summary === "object" &&
      (
        summary.Device ||
        summary.InternetGatewayDevice ||
        summary.DeviceID ||
        summary._id
      )
  );
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

function discoverDynamicConfigPaths(summary, kind) {
  if (!summary) return [];
  const normalizedKind = String(kind || "").toLowerCase();
  const predicate = (path, value) => {
    const normalizedPath = path.toLowerCase();
    if (!("_value" in Object(value || {})) && !("_writable" in Object(value || {}))) {
      return false;
    }
    const isWifiPath =
      normalizedPath.includes("wlanconfiguration") ||
      normalizedPath.includes("device.wifi.ssid") ||
      normalizedPath.includes("device.wifi.accesspoint");
    const isWanPath =
      normalizedPath.includes("wanconnectiondevice") ||
      normalizedPath.includes("wanpppconnection") ||
      normalizedPath.includes("wanipconnection") ||
      normalizedPath.includes("device.ppp.interface") ||
      normalizedPath.includes("device.wan.pppconnection");
    if (normalizedKind === "pppoeusername") return normalizedPath.endsWith(".username");
    if (normalizedKind === "pppoepassword") return normalizedPath.endsWith(".password");
    if (normalizedKind === "wifienable") {
      return isWifiPath && normalizedPath.endsWith(".enable");
    }
    if (!isWifiPath) return false;
    if (normalizedKind === "ssid24") {
      return (
        normalizedPath.endsWith(".ssid") &&
        (
          normalizedPath.includes(".wlanconfiguration.1.") ||
          normalizedPath.includes(".wlanconfiguration.5.") ||
          normalizedPath.includes(".wifi.ssid.1.") ||
          normalizedPath.includes(".wifi.ssid.5.")
        )
      );
    }
    if (normalizedKind === "ssid5") {
      return (
        normalizedPath.endsWith(".ssid") &&
        (
          normalizedPath.includes(".wlanconfiguration.2.") ||
          normalizedPath.includes(".wlanconfiguration.6.") ||
          normalizedPath.includes(".wifi.ssid.2.") ||
          normalizedPath.includes(".wifi.ssid.5.") ||
          normalizedPath.includes(".wifi.ssid.6.")
        )
      );
    }
    if (normalizedKind === "pass24") {
      return (
        (
          normalizedPath.endsWith(".keypassphrase") ||
          normalizedPath.endsWith(".presharedkey.1.keypassphrase")
        ) &&
        (
          normalizedPath.includes(".wlanconfiguration.1.") ||
          normalizedPath.includes(".wlanconfiguration.5.") ||
          normalizedPath.includes(".accesspoint.1.") ||
          normalizedPath.includes(".accesspoint.5.")
        )
      );
    }
    if (normalizedKind === "pass5") {
      return (
        (
          normalizedPath.endsWith(".keypassphrase") ||
          normalizedPath.endsWith(".presharedkey.1.keypassphrase")
        ) &&
        (
          normalizedPath.includes(".wlanconfiguration.2.") ||
          normalizedPath.includes(".wlanconfiguration.6.") ||
          normalizedPath.includes(".accesspoint.2.") ||
          normalizedPath.includes(".accesspoint.5.") ||
          normalizedPath.includes(".accesspoint.6.")
        )
      );
    }
    if (!isWanPath) return false;
    return false;
  };
  return collectMatchingPaths(summary, predicate);
}

async function resolveDeviceIdForWrite(deviceId) {
  for (const variant of deviceIdVariants(deviceId)) {
    const direct = await findDeviceByQuery({ _id: variant });
    if (direct?._id) {
      return direct._id;
    }
    const byDeviceId = await findDeviceByQuery({ "DeviceID.ID": variant });
    if (byDeviceId?._id) {
      return byDeviceId._id;
    }
    const bySerial = await findDeviceByQuery({ "DeviceID.SerialNumber": variant });
    if (bySerial?._id) {
      return bySerial._id;
    }
  }
  return deviceId;
}

async function getWriteTargetDeviceId(deviceId) {
  const resolved = await resolveDeviceIdForWrite(deviceId);
  return resolved || deviceId;
}

export class GenieacsClient {
  async listDevices(limit = 100) {
    const query = `limit=${Math.max(1, Math.min(Number(limit || 100), 500))}`;
    return genieacsRequest("GET", `/devices?${query}`);
  }

  async findDeviceSummary({ deviceId, serialNumber } = {}) {
    if (deviceId) {
      for (const variant of deviceIdVariants(deviceId)) {
        const direct = await findDeviceByQuery({ _id: variant });
        if (direct) return direct;
        const byDeviceId = await findDeviceByQuery({ "DeviceID.ID": variant });
        if (byDeviceId) return byDeviceId;
      }
    }
    if (serialNumber) {
      const bySerial = await findDeviceByQuery({ "DeviceID.SerialNumber": serialNumber });
      if (bySerial) return bySerial;
      const byLegacySerial = await findDeviceByQuery({ "InternetGatewayDevice.DeviceInfo.SerialNumber": serialNumber });
      if (byLegacySerial) return byLegacySerial;
    }
    return null;
  }

  async getRichDeviceSummary({ deviceId, serialNumber } = {}) {
    const summary = await this.findDeviceSummary({ deviceId, serialNumber });
    if (!summary) return null;

    const resolvedDeviceId = summary._id || deviceId;
    if (!resolvedDeviceId) {
      return summary;
    }

    try {
      return await this.getDeviceSummary(resolvedDeviceId);
    } catch {
      return summary;
    }
  }

  async applyPreset({ deviceId, presetName, correlationId }) {
    if (!allowedPresets.has(presetName)) {
      throw new Error(`Preset not allowed: ${presetName}`);
    }

    if (env.MOCK_EXTERNALS) {
      return { ok: true, deviceId, presetName, correlationId, source: "mock-genieacs" };
    }

    // Preset-only approach: add a tag and trigger device interaction.
    let targetDeviceId = deviceId;
    const buildTagPath = (id) => `/devices/${encodeURIComponent(id)}/tags/${encodeURIComponent(presetName)}`;
    const buildTaskPath = (id) => `/devices/${encodeURIComponent(id)}/tasks`;

    let tagPath = buildTagPath(targetDeviceId);
    const trySetTag = async () => {
      try {
        await genieacsRequest("POST", tagPath);
        return;
      } catch (postError) {
        if (!String(postError.message).includes("405")) {
          throw postError;
        }
      }
      await genieacsRequest("PUT", tagPath);
    };

    try {
      await trySetTag();
    } catch (error) {
      if (String(error.message).includes("404") && String(error.message).includes("No such device")) {
        targetDeviceId = await resolveDeviceIdForWrite(deviceId);
        tagPath = buildTagPath(targetDeviceId);
        await trySetTag();
      } else {
        throw error;
      }
    }

    try {
      await genieacsRequest("POST", `${buildTaskPath(targetDeviceId)}?connection_request`, {
        name: "getParameterValues",
        parameterNames: ["DeviceID.ID"]
      });
    } catch (error) {
      if (!String(error.message).includes("405")) {
        throw error;
      }
      await genieacsRequest("POST", buildTaskPath(targetDeviceId), {
        name: "getParameterValues",
        parameterNames: ["DeviceID.ID"]
      });
    }

    return { ok: true, deviceId: targetDeviceId, presetName, correlationId };
  }

  async getDeviceSummary(deviceId) {
    try {
      return await genieacsRequest("GET", `/devices/${encodeURIComponent(deviceId)}`);
    } catch (error) {
      // Some GenieACS deployments reject direct GET /devices/:id and only support query-based reads.
      if (!String(error.message).includes("405")) {
        throw error;
      }
      const query = encodeURIComponent(JSON.stringify({ _id: deviceId }));
      const devices = await genieacsRequest("GET", `/devices?query=${query}`);
      if (Array.isArray(devices)) {
        return devices[0] || null;
      }
      return devices;
    }
  }

  async runTask(deviceId, task, options = {}) {
    const targetDeviceId = await getWriteTargetDeviceId(deviceId);
    const suffix = options.connectionRequest ? "?connection_request" : "";
    return genieacsRequest("POST", `/devices/${encodeURIComponent(targetDeviceId)}/tasks${suffix}`, task);
  }

  async setParameterValues(deviceId, parameterValues, options = {}) {
    const targetDeviceId = await getWriteTargetDeviceId(deviceId);
    const suffix = options.connectionRequest ? "?connection_request" : "";
    return genieacsRequest("POST", `/devices/${encodeURIComponent(targetDeviceId)}/tasks${suffix}`, {
      name: "setParameterValues",
      parameterValues
    });
  }

  async rebootDevice(deviceId, options = {}) {
    const targetDeviceId = await getWriteTargetDeviceId(deviceId);
    const suffix = options.connectionRequest ? "?connection_request" : "";
    return genieacsRequest("POST", `/devices/${encodeURIComponent(targetDeviceId)}/tasks${suffix}`, {
      name: "reboot"
    });
  }

  async setWifiPaused(deviceId, { paused, brand = "generic" } = {}) {
    const profile = resolveProvisioningProfile(brand);
    let liveSummary = null;
    try {
      liveSummary = await this.getRichDeviceSummary({ deviceId });
    } catch {
      liveSummary = null;
    }
    if (!isUsableDeviceSummary(liveSummary)) {
      liveSummary = null;
    }

    const enableValue = !paused;
    const dynamicEnablePaths = discoverDynamicConfigPaths(liveSummary, "wifiEnable");
    const fallbackEnablePaths = [
      ...(String(brand || "").toLowerCase() === "nokia" ? buildNokiaEnablePaths() : []),
      ...(profile.ssid24Path || []).map((path) => String(path).replace(/\.SSID$/i, ".Enable")),
      ...(profile.ssid5Path || []).map((path) => String(path).replace(/\.SSID$/i, ".Enable"))
    ];
    const candidatePaths = [...new Set([...dynamicEnablePaths, ...fallbackEnablePaths])];
    const selectedPaths = selectExistingPaths(liveSummary, candidatePaths);
    const values = selectedPaths
      .filter(Boolean)
      .map((path) => [path, enableValue, "xsd:boolean"]);

    if (values.length > 0) {
      for (const entry of values) {
        await this.setParameterValues(deviceId, [entry], { connectionRequest: true });
      }
    }

    return { ok: true, deviceId, paused: Boolean(paused), configured: values.length };
  }

  async setGuestWifi(deviceId, {
    enabled,
    ssid,
    password,
    brand = "generic"
  } = {}) {
    const normalizedBrand = String(brand || "").toLowerCase();
    if (normalizedBrand !== "nokia") {
      return { ok: true, deviceId, enabled: Boolean(enabled), configured: 0, syncMode: "cache_only" };
    }

    const parameterValues = [];
    if (enabled) {
      const guestSsid = String(ssid || "").trim();
      const guestPassword = String(password || "").trim();
      for (const path of [
        ...buildNokiaGuestSsidPaths("ssid24"),
        ...buildNokiaGuestSsidPaths("ssid5")
      ]) {
        if (guestSsid) {
          parameterValues.push([path, guestSsid]);
        }
      }
      for (const path of [
        ...buildNokiaGuestPasswordPaths("ssid24"),
        ...buildNokiaGuestPasswordPaths("ssid5")
      ]) {
        if (guestPassword) {
          parameterValues.push([path, guestPassword]);
        }
      }
    }

    for (const path of buildNokiaGuestEnablePaths()) {
      parameterValues.push([path, Boolean(enabled), "xsd:boolean"]);
    }

    for (const entry of parameterValues) {
      await this.setParameterValues(deviceId, [entry], { connectionRequest: true });
    }

    return { ok: true, deviceId, enabled: Boolean(enabled), configured: parameterValues.length };
  }

  async getWifiPauseSummary(deviceId, { brand = "generic" } = {}) {
    const summary = await this.getRichDeviceSummary({ deviceId });
    if (!summary || String(brand || "").toLowerCase() !== "nokia") {
      return null;
    }

    const slots = listNokiaWlanSlots().map((slot) => {
      const base = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${slot}`;
      const enabledNode = readNodeAtPath(summary, `${base}.Enable`);
      return {
        slot,
        band: getNokiaSlotBand(slot),
        enabled: normalizeWifiEnableValue(enabledNode),
        ssid: extractNodeValue(readNodeAtPath(summary, `${base}.SSID`))
      };
    });

    return {
      enabledSlots: slots.filter((slot) => slot.enabled === true).map((slot) => slot.slot),
      disabledSlots: slots.filter((slot) => slot.enabled === false).map((slot) => slot.slot),
      allEnabled: slots.every((slot) => slot.enabled === true),
      allDisabled: slots.every((slot) => slot.enabled === false),
      slots
    };
  }

  async pushAccessConfig({
    deviceId,
    brand = "generic",
    pppoeUsername,
    pppoePassword,
    vlanId,
    natEnabled,
    ssid24,
    ssid5,
    wifiPassword,
    wifiPassword24,
    wifiPassword5
  }) {
    const profile = resolveProvisioningProfile(brand);
    let liveSummary = null;
    try {
      liveSummary = await this.getRichDeviceSummary({ deviceId });
    } catch {
      liveSummary = null;
    }
    if (!isUsableDeviceSummary(liveSummary)) {
      liveSummary = null;
    }
    const dynamicPppoeUsernamePaths = discoverDynamicConfigPaths(liveSummary, "pppoeUsername");
    const dynamicPppoePasswordPaths = discoverDynamicConfigPaths(liveSummary, "pppoePassword");
    const dynamicSsid24Paths = discoverDynamicConfigPaths(liveSummary, "ssid24");
    const dynamicPass24Paths = discoverDynamicConfigPaths(liveSummary, "pass24");
    const dynamicSsid5Paths = discoverDynamicConfigPaths(liveSummary, "ssid5");
    const dynamicPass5Paths = discoverDynamicConfigPaths(liveSummary, "pass5");
    const normalizedSsid24 = typeof ssid24 === "string" ? ssid24.trim() : ssid24;
    const normalizedSsid5 = typeof ssid5 === "string" ? ssid5.trim() : ssid5;
    const normalizedPass24 = typeof (wifiPassword24 ?? wifiPassword) === "string"
      ? (wifiPassword24 ?? wifiPassword).trim()
      : (wifiPassword24 ?? wifiPassword);
    const normalizedPass5 = typeof (wifiPassword5 ?? wifiPassword24 ?? wifiPassword) === "string"
      ? (wifiPassword5 ?? wifiPassword24 ?? wifiPassword).trim()
      : (wifiPassword5 ?? wifiPassword24 ?? wifiPassword);
    const unifyWifiAliases = isUnifiedNokiaWifiRequest({
      brand,
      ssid24: normalizedSsid24,
      ssid5: normalizedSsid5,
      password24: normalizedPass24,
      password5: normalizedPass5
    });
    const values = [];
    const wifiValues = [];
    const push = (pathOrPaths, value, valueType, transform = (input) => input, options = {}) => {
      const wifiMultiPath = Boolean(options.wifiMultiPath) || (
        pathOrPaths === profile.ssid24Path ||
        pathOrPaths === profile.pass24Path ||
        pathOrPaths === profile.ssid5Path ||
        pathOrPaths === profile.pass5Path
      );
      const configMultiPath = Boolean(options.configMultiPath);
      const dynamicPaths =
        pathOrPaths === profile.pppoeUsernamePath
          ? dynamicPppoeUsernamePaths
          : pathOrPaths === profile.pppoePasswordPath
            ? dynamicPppoePasswordPaths
            : pathOrPaths === profile.ssid24Path
              ? dynamicSsid24Paths
              : pathOrPaths === profile.pass24Path
                ? dynamicPass24Paths
                : pathOrPaths === profile.ssid5Path
                  ? dynamicSsid5Paths
                  : pathOrPaths === profile.pass5Path
                    ? dynamicPass5Paths
            : [];
      const preferredPaths = dynamicPaths.length ? [...dynamicPaths, ...(Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths])] : pathOrPaths;
      const paths = selectExistingPaths(liveSummary, preferredPaths);
      const writablePaths = liveSummary
        ? paths.filter((path) => {
            const normalizedPath = String(path || "").split("|")[0];
            return isWritableParameterNode(readNodeAtPath(liveSummary, normalizedPath));
          })
        : paths;
      const selectedPaths = wifiMultiPath
        ? paths
        : configMultiPath
          ? (writablePaths.length ? writablePaths : paths)
          : (writablePaths.length ? writablePaths : paths).slice(0, 1);
      for (const path of selectedPaths) {
        if (path && value !== undefined && value !== null && value !== "") {
          const [rawPath, inlineValue] = String(path).split("|");
          const normalizedValue = transform(value);
          const finalValue = inlineValue ?? normalizedValue;
          const entry = valueType ? [rawPath, finalValue, valueType] : [rawPath, finalValue];
          values.push(entry);
          if (wifiMultiPath) {
            wifiValues.push(entry);
          }
        }
      }
    };
    const normalizedBrand = String(brand || "").toLowerCase();
    const multiPathPppoe = ["dasan", "nokia", "zte", "syrotech", "tp-link", "secureeye", "gx", "zyxel"].includes(normalizedBrand);
    push(profile.pppoeUsernamePath, pppoeUsername, undefined, (input) => input, { configMultiPath: multiPathPppoe });
    push(profile.pppoePasswordPath, pppoePassword, undefined, (input) => input, { configMultiPath: multiPathPppoe });
    if (vlanId !== undefined && vlanId !== null && vlanId !== "") {
      push(profile.vlanPath, vlanId, "xsd:unsignedInt", Number);
    }
    if (natEnabled !== undefined && natEnabled !== null) {
      push(profile.natPath, natEnabled, "xsd:boolean", Boolean, { configMultiPath: normalizedBrand === "dasan" });
    }
    if (Array.isArray(profile.wifiSecurity24Path) && profile.wifiSecurity24Path.length > 0) {
      push(profile.wifiSecurity24Path, true, undefined, () => undefined, { wifiMultiPath: true });
    }
    if (Array.isArray(profile.wifiSecurity5Path) && profile.wifiSecurity5Path.length > 0) {
      push(profile.wifiSecurity5Path, true, undefined, () => undefined, { wifiMultiPath: true });
    }
    if (unifyWifiAliases) {
      push([...profile.ssid24Path, ...profile.ssid5Path], normalizedSsid24, undefined, (input) => input, { wifiMultiPath: true });
      push([...profile.pass24Path, ...profile.pass5Path], normalizedPass24, undefined, (input) => input, { wifiMultiPath: true });
    } else {
      push(profile.ssid24Path, ssid24);
      push(profile.pass24Path, wifiPassword24 ?? wifiPassword);
      push(profile.ssid5Path, ssid5);
      push(profile.pass5Path, wifiPassword5 ?? wifiPassword24 ?? wifiPassword);
    }

    if (values.length > 0) {
      const nonWifiValues = values.filter((entry) => !wifiValues.includes(entry));
      if (nonWifiValues.length > 0) {
        for (const entry of nonWifiValues) {
          await this.setParameterValues(deviceId, [entry], { connectionRequest: true });
        }
      }

      if (wifiValues.length > 0) {
        for (const entry of wifiValues) {
          await this.setParameterValues(deviceId, [entry], { connectionRequest: true });
        }
      }
    }

    return { ok: true, deviceId, brand, configured: values.length };
  }
}

export const genieacsClient = new GenieacsClient();
export { allowedPresets };
