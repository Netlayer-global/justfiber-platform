import { pathToFileURL } from "node:url";

function getBaseUrl() {
  return process.env.LIVE_SCENARIO_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
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

function logStep(label, value) {
  console.log(`[PASS] ${label}${value ? ` (${value})` : ""}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInstallerAssignment({ bookingNumber, customerToken, timeoutMs = 30000, pollMs = 2000 }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tracking = await requestJson({
      path: `/api/v1/customer/bookings/${bookingNumber}/tracking`,
      token: customerToken
    });
    const installerStep = (tracking.data.steps || []).find((step) => step.code === "installer_assigned");
    if (tracking.data.currentStep === "installer_assigned" && installerStep?.jobId) {
      return {
        currentStep: tracking.data.currentStep,
        jobId: installerStep.jobId
      };
    }
    await sleep(pollMs);
  }
  throw new Error(`Booking ${bookingNumber} not assigned to installer within ${timeoutMs / 1000}s. Ensure at least one installer is available.`);
}

async function runLiveNokiaScenario() {
  const mobile = requireEnv("LIVE_CUSTOMER_MOBILE");
  const fullName = requireEnv("LIVE_CUSTOMER_NAME");
  const address = requireEnv("LIVE_CUSTOMER_ADDRESS");
  const pinCode = requireEnv("LIVE_CUSTOMER_PIN");
  const planCode = requireEnv("LIVE_PLAN_CODE");
  const jazeUserId = requireEnv("LIVE_JAZE_USER_ID");
  const installerLogin = requireEnv("LIVE_INSTALLER_LOGIN");
  const installerPassword = requireEnv("LIVE_INSTALLER_PASSWORD");
  const serialNumber = requireEnv("LIVE_NOKIA_SERIAL");
  const deviceId = process.env.LIVE_NOKIA_DEVICE_ID;
  const lat = Number(process.env.LIVE_LAT || "26.8467");
  const lng = Number(process.env.LIVE_LNG || "80.9462");
  const rxPower = Number(process.env.LIVE_RX_POWER || "-19.5");
  const txPower = Number(process.env.LIVE_TX_POWER || "1.2");

  const sendOtp = await requestJson({
    method: "POST",
    path: "/api/v1/customer/auth/send-otp",
    body: { mobile }
  });
  const otp = sendOtp.data.demoOtp;
  const verifyOtp = await requestJson({
    method: "POST",
    path: "/api/v1/customer/auth/verify-otp",
    body: { mobile, otp, fullName }
  });
  const customerToken = verifyOtp.data.accessToken;
  logStep("Customer login", mobile);

  const booking = await requestJson({
    method: "POST",
    path: "/api/v1/customer/bookings",
    token: customerToken,
    body: {
      planCode,
      fullName,
      mobile,
      fullAddress: address,
      pinCode,
      lat,
      lng,
      paymentMode: "jaze",
      jazeUserId
    }
  });
  const bookingNumber = booking.data.bookingNumber;
  logStep("Booking created", bookingNumber);

  await requestJson({
    method: "POST",
    path: `/api/v1/customer/bookings/${bookingNumber}/payment/link-jaze`,
    token: customerToken,
    body: { jazeUserId }
  });
  logStep("Booking payment link generated", bookingNumber);

  await requestJson({
    method: "POST",
    path: `/api/v1/customer/bookings/${bookingNumber}/payment/confirm`,
    token: customerToken,
    body: {
      status: "paid",
      paymentId: `LIVE-JAZE-${Date.now()}`,
      reference: `LIVE-JAZE-REF-${Date.now()}`,
      notes: "Live Nokia activation flow"
    }
  });
  logStep("Booking payment confirmed", bookingNumber);

  const assignment = await waitForInstallerAssignment({
    bookingNumber,
    customerToken,
    timeoutMs: Number(process.env.LIVE_ASSIGN_TIMEOUT_MS || "30000"),
    pollMs: Number(process.env.LIVE_ASSIGN_POLL_MS || "2000")
  });
  logStep("Booking tracking", assignment.currentStep);

  const installerLoginPayload = await requestJson({
    method: "POST",
    path: "/api/v1/installer/auth/login",
    body: { login: installerLogin, password: installerPassword }
  });
  const installerToken = installerLoginPayload.data.accessToken;
  logStep("Installer login", installerLogin);

  const jobs = await requestJson({ path: "/api/v1/installer/jobs", token: installerToken });
  const job = (jobs.data || []).find((item) => item._id === assignment.jobId || item.customerId === bookingNumber);
  if (!job?._id) {
    throw new Error(`Installer job ${assignment.jobId} not visible for booking ${bookingNumber}. Check installer assignment.`);
  }
  const jobId = job._id;
  logStep("Installer job found", job.jobNumber || jobId);

  await requestJson({ path: `/api/v1/installer/jobs/${jobId}/provisioning-preview`, token: installerToken });
  logStep("Provisioning preview", "nokia");

  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${jobId}/accept`, token: installerToken, body: {} });
  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${jobId}/start-travel`, token: installerToken, body: {} });
  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${jobId}/start-onsite`, token: installerToken, body: {} });
  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${jobId}/checkin-location`,
    token: installerToken,
    body: { lat, lng, address }
  });
  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${jobId}/manual-serial`,
    token: installerToken,
    body: {
      serialNumber,
      ...(deviceId ? { deviceId } : {})
    }
  });
  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${jobId}/check-optical`,
    token: installerToken,
    body: { rxPower, txPower }
  });
  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${jobId}/save-checklist`,
    token: installerToken,
    body: {
      fiberLinked: true,
      powerLevelOk: true,
      wanConfigured: true,
      wifiConfigured: true,
      speedTestDone: true,
      customerEducated: true,
      notes: "Live Nokia activation checklist"
    }
  });
  logStep("Installer pre-activation flow complete", jobId);

  if (String(process.env.LIVE_RUN_ACTIVATION || "false").toLowerCase() === "true") {
    const activation = await requestJson({
      method: "POST",
      path: `/api/v1/installer/jobs/${jobId}/activate`,
      token: installerToken,
      body: {}
    });
    logStep("Installer activation requested", activation.data.status);
  } else {
    console.log("[SKIP] LIVE_RUN_ACTIVATION is not true. Activation step skipped.");
  }

  console.log("\nLive Nokia scenario summary:");
  console.log(`- bookingNumber: ${bookingNumber}`);
  console.log(`- installerJobId: ${jobId}`);
  console.log(`- serialNumber: ${serialNumber}`);
  if (deviceId) {
    console.log(`- deviceId: ${deviceId}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLiveNokiaScenario()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
