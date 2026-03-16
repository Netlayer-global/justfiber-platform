import { env } from "../config/env.js";

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

export class GenieacsClient {
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
      await genieacsRequest("POST", `${buildTaskPath(targetDeviceId)}?connection_request`);
    } catch (error) {
      if (!String(error.message).includes("405")) {
        throw error;
      }
      await genieacsRequest("POST", buildTaskPath(targetDeviceId), {
        name: "refreshObject",
        objectName: "InternetGatewayDevice"
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
}

export const genieacsClient = new GenieacsClient();
export { allowedPresets };
