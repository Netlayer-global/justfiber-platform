import { pathToFileURL } from "node:url";

function getBaseUrl() {
  return process.env.INSTALLER_TEST_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function requestJson({ method = "GET", path, token, body, expectedStatus = 200 }) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await parseResponse(response);
  if (response.status !== expectedStatus) {
    throw new Error(`${method} ${path} expected ${expectedStatus} but got ${response.status}: ${JSON.stringify(payload)}`);
  }
  if (typeof payload !== "object" || payload === null || payload.success !== true) {
    throw new Error(`${method} ${path} did not return success envelope`);
  }
  return payload;
}

function printPass(label, details) {
  console.log(`[PASS] ${label}${details ? ` (${details})` : ""}`);
}

async function runInstallerModuleTest() {
  const login = process.env.TEST_INSTALLER_LOGIN || "9000000001";
  const password = process.env.TEST_INSTALLER_PASSWORD || "Installer123!";
  const loginPayload = await requestJson({
    method: "POST",
    path: "/api/v1/installer/auth/login",
    body: { login, password }
  });
  const token = loginPayload.data.accessToken;
  if (!token) {
    throw new Error("Missing installer access token");
  }
  printPass("Installer login", login);

  const jobsPayload = await requestJson({ path: "/api/v1/installer/jobs", token });
  const job = jobsPayload.data?.[0];
  if (!job?._id) {
    throw new Error("No installer jobs available for test");
  }
  const jobId = job._id;
  printPass("Installer jobs list", job.jobNumber || jobId);

  const preview = await requestJson({ path: `/api/v1/installer/jobs/${jobId}/provisioning-preview`, token });
  printPass("Installer provisioning preview", preview.data.brand);

  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${jobId}/accept`, token, body: {} });
  printPass("Installer accept job", jobId);

  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${jobId}/start-travel`, token, body: {} });
  printPass("Installer start travel", jobId);

  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${jobId}/start-onsite`, token, body: {} });
  printPass("Installer start onsite", jobId);

  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${jobId}/checkin-location`,
    token,
    body: { lat: 26.8467, lng: 80.9462, address: "Installer test location" }
  });
  printPass("Installer location check-in", jobId);

  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${jobId}/manual-serial`,
    token,
    body: { serialNumber: process.env.TEST_INSTALLER_SERIAL || "ALCLB3DCCB87" }
  });
  printPass("Installer manual serial", jobId);

  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${jobId}/check-optical`,
    token,
    body: { rxPower: -19.5, txPower: 1.2 }
  });
  printPass("Installer optical check", jobId);

  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${jobId}/save-checklist`,
    token,
    body: {
      fiberLinked: true,
      powerLevelOk: true,
      wanConfigured: true,
      wifiConfigured: true,
      speedTestDone: true,
      customerEducated: true,
      notes: "Installer test flow"
    }
  });
  printPass("Installer save checklist", jobId);

  const diagnostics = await requestJson({ path: `/api/v1/installer/jobs/${jobId}/diagnostics`, token });
  printPass("Installer diagnostics", diagnostics.data.status);

  console.log("\nInstaller module test summary:");
  console.log(`- installer auth/jobs/onsite/precheck flow: OK (${jobId})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runInstallerModuleTest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
