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
    throw new Error(`GenieACS request failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

export class GenieacsClient {
  async applyPreset({ deviceId, presetName, correlationId }) {
    if (!allowedPresets.has(presetName)) {
      throw new Error(`Preset not allowed: ${presetName}`);
    }

    if (env.MOCK_EXTERNALS) {
      return { ok: true, deviceId, presetName, correlationId, source: "mock-genieacs" };
    }

    // Preset-only approach: add a tag and trigger a connection request task.
    await genieacsRequest("PUT", `/devices/${encodeURIComponent(deviceId)}/tags/${encodeURIComponent(presetName)}`);
    await genieacsRequest("POST", `/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
      name: "refreshObject",
      objectName: "InternetGatewayDevice"
    });

    return { ok: true, deviceId, presetName, correlationId };
  }

  async getDeviceSummary(deviceId) {
    return genieacsRequest("GET", `/devices/${encodeURIComponent(deviceId)}`);
  }
}

export const genieacsClient = new GenieacsClient();
export { allowedPresets };
