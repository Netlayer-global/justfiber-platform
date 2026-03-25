import { pathToFileURL } from "node:url";

function getBaseUrl() {
  return process.env.PROVISION_TEST_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(process.env.PROVISION_TEST_ORIGIN ? { Origin: process.env.PROVISION_TEST_ORIGIN } : {})
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

function requireDemoOtp(payload, path) {
  const otp = payload?.data?.demoOtp;
  if (!otp) {
    throw new Error(`${path} did not expose demoOtp. Set EXPOSE_DEMO_OTP=true for local scripted OTP login tests.`);
  }
  return otp;
}

async function waitForAssignment({ bookingNumber, customerToken, timeoutMs = 30000, pollMs = 2000 }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tracking = await requestJson({
      path: `/api/v1/customer/bookings/${bookingNumber}/tracking`,
      token: customerToken
    });
    const installerStep = (tracking.data.steps || []).find((step) => step.code === "installer_assigned");
    if (tracking.data.currentStep === "installer_assigned" && installerStep?.jobId) {
      return installerStep.jobId;
    }
    await sleep(pollMs);
  }
  throw new Error(`Booking ${bookingNumber} was not assigned within ${timeoutMs / 1000}s`);
}

async function runProvisioningFlowTest() {
  const mobile = process.env.PROVISION_TEST_MOBILE || "9876501234";
  const fullName = process.env.PROVISION_TEST_NAME || "Provision Flow User";
  const address = process.env.PROVISION_TEST_ADDRESS || "Gomti Nagar, Lucknow";
  const pinCode = process.env.PROVISION_TEST_PIN || "226010";
  const lat = Number(process.env.PROVISION_TEST_LAT || "26.8467");
  const lng = Number(process.env.PROVISION_TEST_LNG || "80.9462");
  const planCode = process.env.PROVISION_TEST_PLAN || "PLAN-100";
  const installerLogin = process.env.PROVISION_TEST_INSTALLER_LOGIN || "INS-1001";
  const installerPassword = process.env.PROVISION_TEST_INSTALLER_PASSWORD || "Installer123!";
  const serialNumber = process.env.PROVISION_TEST_SERIAL || `AUTO${Date.now()}`;

  const sendOtp = await requestJson({
    method: "POST",
    path: "/api/v1/customer/auth/send-otp",
    body: { mobile }
  });
  const otp = requireDemoOtp(sendOtp, "/api/v1/customer/auth/send-otp");
  const verify = await requestJson({
    method: "POST",
    path: "/api/v1/customer/auth/verify-otp",
    body: { mobile, otp, fullName }
  });
  const customerToken = verify.data.accessToken;
  printPass("Customer login", mobile);

  const feasibility = await requestJson({
    method: "POST",
    path: "/api/v1/customer/feasibility/check",
    body: { lat, lng, address }
  });
  if (!feasibility.data?.feasible) {
    throw new Error(`Test address is not feasible: ${feasibility.data?.message || "unknown reason"}`);
  }
  printPass("Customer feasibility", feasibility.data.matchedZone?.zoneName || feasibility.data.serviceStatus);

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
      paymentMode: "cash"
    }
  });
  const bookingNumber = booking.data.bookingNumber;
  if (!bookingNumber) {
    throw new Error("Booking number missing");
  }
  printPass("Customer booking", bookingNumber);

  const bookings = await requestJson({
    path: "/api/v1/customer/bookings",
    token: customerToken
  });
  const ownBooking = (bookings.data || []).find((item) => item.bookingNumber === bookingNumber);
  if (!ownBooking) {
    throw new Error("Booking not visible in customer booking list");
  }
  printPass("Customer booking list", bookingNumber);

  const jobId = await waitForAssignment({
    bookingNumber,
    customerToken,
    timeoutMs: Number(process.env.PROVISION_TEST_ASSIGN_TIMEOUT_MS || "30000"),
    pollMs: Number(process.env.PROVISION_TEST_ASSIGN_POLL_MS || "2000")
  });
  printPass("Auto installer assignment", jobId);

  const installerLoginPayload = await requestJson({
    method: "POST",
    path: "/api/v1/installer/auth/login",
    body: { login: installerLogin, password: installerPassword }
  });
  const installerToken = installerLoginPayload.data.accessToken;
  if (!installerToken) {
    throw new Error("Installer access token missing");
  }
  printPass("Installer login", installerLogin);

  const jobs = await requestJson({
    path: "/api/v1/installer/jobs",
    token: installerToken
  });
  const installerJob = (jobs.data || []).find((item) => item._id === jobId || item.customerId === bookingNumber);
  if (!installerJob?._id) {
    throw new Error(`Assigned job ${jobId} not visible to installer`);
  }
  printPass("Installer job visibility", installerJob.jobNumber || installerJob._id);

  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${installerJob._id}/accept`, token: installerToken, body: {} });
  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${installerJob._id}/start-travel`, token: installerToken, body: {} });
  await requestJson({ method: "POST", path: `/api/v1/installer/jobs/${installerJob._id}/start-onsite`, token: installerToken, body: {} });
  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${installerJob._id}/checkin-location`,
    token: installerToken,
    body: { lat, lng, address }
  });
  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${installerJob._id}/manual-serial`,
    token: installerToken,
    body: { serialNumber }
  });
  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${installerJob._id}/check-optical`,
    token: installerToken,
    body: { rxPower: -19.5, txPower: 1.2 }
  });
  await requestJson({
    method: "POST",
    path: `/api/v1/installer/jobs/${installerJob._id}/save-checklist`,
    token: installerToken,
    body: {
      fiberLinked: true,
      powerLevelOk: true,
      wanConfigured: true,
      wifiConfigured: true,
      speedTestDone: true,
      customerEducated: true,
      notes: "Provisioning smoke flow"
    }
  });
  printPass("Installer onsite flow", installerJob._id);

  const notifications = await requestJson({
    path: "/api/v1/installer/notifications",
    token: installerToken
  });
  if (!Array.isArray(notifications.data)) {
    throw new Error("Installer notifications payload invalid");
  }
  printPass("Installer notifications", String(notifications.data.length));

  console.log("\nProvisioning flow test summary:");
  console.log(`- bookingNumber: ${bookingNumber}`);
  console.log(`- installerJobId: ${installerJob._id}`);
  console.log(`- installerLogin: ${installerLogin}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProvisioningFlowTest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
