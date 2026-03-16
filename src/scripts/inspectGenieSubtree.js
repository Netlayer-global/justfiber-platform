import { env } from "../config/env.js";

const DEVICE_ID = process.env.INSPECT_GENIE_DEVICE_ID;
const RAW_PATHS = process.env.INSPECT_GENIE_PATHS || "";

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

async function loadDevice(deviceId) {
  const directResponse = await fetch(new URL(`/devices/${encodeURIComponent(deviceId)}`, env.GENIEACS_URL), {
    headers: buildHeaders()
  });
  if (directResponse.ok) {
    return directResponse.json();
  }

  const directText = await directResponse.text();
  if (directResponse.status !== 405) {
    throw new Error(`Failed to fetch GenieACS device: ${directResponse.status} ${directText}`);
  }

  const query = encodeURIComponent(JSON.stringify({ _id: deviceId }));
  const queryResponse = await fetch(new URL(`/devices?query=${query}`, env.GENIEACS_URL), {
    headers: buildHeaders()
  });
  if (!queryResponse.ok) {
    const queryText = await queryResponse.text();
    throw new Error(`Failed to query GenieACS device: ${queryResponse.status} ${queryText}`);
  }
  const result = await queryResponse.json();
  return Array.isArray(result) ? result[0] : result;
}

async function main() {
  if (!DEVICE_ID) {
    throw new Error("Missing INSPECT_GENIE_DEVICE_ID");
  }
  if (!RAW_PATHS.trim()) {
    throw new Error("Missing INSPECT_GENIE_PATHS");
  }
  if (env.MOCK_EXTERNALS) {
    throw new Error("MOCK_EXTERNALS=true. Set MOCK_EXTERNALS=false before live GenieACS inspection.");
  }

  const payload = await loadDevice(DEVICE_ID);
  if (!payload) {
    throw new Error(`Device ${DEVICE_ID} not found in GenieACS`);
  }

  const paths = RAW_PATHS
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const output = {
    deviceId: payload._id,
    serialNumber: payload?._deviceId?._SerialNumber,
    productClass: payload?._deviceId?._ProductClass,
    subtrees: {}
  };

  for (const path of paths) {
    output.subtrees[path] = getByPath(payload, path) ?? null;
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
