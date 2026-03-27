import { env } from "../config/env.js";
import { buildNokiaInspectPaths } from "../common/nokiaWifi.js";

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

  let payload;
  {
    const response = await fetch(new URL(`/devices/${encodeURIComponent(DEVICE_ID)}`, env.GENIEACS_URL), {
      headers: buildHeaders()
    });
    if (response.ok) {
      payload = await response.json();
    } else {
      const text = await response.text();
      if (response.status !== 405) {
        throw new Error(`Failed to fetch GenieACS device: ${response.status} ${text}`);
      }
      const query = encodeURIComponent(JSON.stringify({ _id: DEVICE_ID }));
      const queryResponse = await fetch(new URL(`/devices?query=${query}`, env.GENIEACS_URL), {
        headers: buildHeaders()
      });
      if (!queryResponse.ok) {
        const queryText = await queryResponse.text();
        throw new Error(`Failed to query GenieACS device: ${queryResponse.status} ${queryText}`);
      }
      const result = await queryResponse.json();
      payload = Array.isArray(result) ? result[0] : result;
    }
  }
  if (!payload) {
    throw new Error(`Device ${DEVICE_ID} not found in GenieACS`);
  }

  const candidatePaths = buildNokiaInspectPaths();

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
