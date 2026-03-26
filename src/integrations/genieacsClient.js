import { env } from "../config/env.js";
import { resolveProvisioningProfile } from "../common/networkProvisioning.js";

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

async function resolveDeviceIdForWrite(deviceId) {
  const direct = await findDeviceByQuery({ _id: deviceId });
  if (direct?._id) {
    return direct._id;
  }
  const byDeviceId = await findDeviceByQuery({ "DeviceID.ID": deviceId });
  if (byDeviceId?._id) {
    return byDeviceId._id;
  }
  const bySerial = await findDeviceByQuery({ "DeviceID.SerialNumber": deviceId });
  if (bySerial?._id) {
    return bySerial._id;
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
      const direct = await findDeviceByQuery({ _id: deviceId });
      if (direct) return direct;
      const byDeviceId = await findDeviceByQuery({ "DeviceID.ID": deviceId });
      if (byDeviceId) return byDeviceId;
    }
    if (serialNumber) {
      const bySerial = await findDeviceByQuery({ "DeviceID.SerialNumber": serialNumber });
      if (bySerial) return bySerial;
      const byLegacySerial = await findDeviceByQuery({ "InternetGatewayDevice.DeviceInfo.SerialNumber": serialNumber });
      if (byLegacySerial) return byLegacySerial;
    }
    return null;
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
      await genieacsRequest("POST", buildTaskPath(targetDeviceId), {
        name: "refreshObject",
        objectName: "InternetGatewayDevice."
      });
    } catch (error) {
      if (!String(error.message).includes("405")) {
        throw error;
      }
      await genieacsRequest("POST", `${buildTaskPath(targetDeviceId)}?connection_request`);
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

  async runTask(deviceId, task) {
    const targetDeviceId = await getWriteTargetDeviceId(deviceId);
    return genieacsRequest("POST", `/devices/${encodeURIComponent(targetDeviceId)}/tasks`, task);
  }

  async setParameterValues(deviceId, parameterValues) {
    const targetDeviceId = await getWriteTargetDeviceId(deviceId);
    return genieacsRequest("POST", `/devices/${encodeURIComponent(targetDeviceId)}/tasks`, {
      name: "setParameterValues",
      parameterValues
    });
  }

  async rebootDevice(deviceId) {
    const targetDeviceId = await getWriteTargetDeviceId(deviceId);
    return genieacsRequest("POST", `/devices/${encodeURIComponent(targetDeviceId)}/tasks`, {
      name: "reboot"
    });
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
    const values = [];
    const push = (pathOrPaths, value, valueType, transform = (input) => input) => {
      const paths = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths];
      for (const path of paths) {
        if (path && value !== undefined && value !== null && value !== "") {
          const normalizedValue = transform(value);
          values.push(valueType ? [path, normalizedValue, valueType] : [path, normalizedValue]);
        }
      }
    };
    push(profile.pppoeUsernamePath, pppoeUsername);
    push(profile.pppoePasswordPath, pppoePassword);
    if (vlanId !== undefined && vlanId !== null && vlanId !== "") {
      push(profile.vlanPath, vlanId, "xsd:unsignedInt", Number);
    }
    if (natEnabled !== undefined && natEnabled !== null) {
      push(profile.natPath, natEnabled, "xsd:boolean", Boolean);
    }
    push(profile.ssid24Path, ssid24);
    push(profile.pass24Path, wifiPassword24 ?? wifiPassword);
    push(profile.ssid5Path, ssid5);
    push(profile.pass5Path, wifiPassword5 ?? wifiPassword24 ?? wifiPassword);

    if (values.length > 0) {
      await this.setParameterValues(deviceId, values);
    }

    await this.runTask(deviceId, {
      name: "refreshObject",
      objectName: "InternetGatewayDevice."
    });

    return { ok: true, deviceId, brand, configured: values.length };
  }
}

export const genieacsClient = new GenieacsClient();
export { allowedPresets };
