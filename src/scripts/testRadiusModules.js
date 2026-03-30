import { connectMongo } from "../db/mongoose.js";
import { radiusServiceManager } from "../integrations/radiusServiceManager.js";
import { SubscriberService } from "../models/SubscriberService.js";

function fail(message, extra) {
  if (extra !== undefined) {
    console.error(message, extra);
  } else {
    console.error(message);
  }
  process.exit(1);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function summarizeServiceControl(result) {
  return {
    radiusState: result?.radiusState || null,
    serviceStatus: result?.status || null,
    disconnectStatus: result?.serviceControl?.status || result?.bngSession?.status || null,
    disconnectAttempted: Boolean(result?.serviceControl?.attempted ?? result?.bngSession?.attempted),
    disconnectPayloadMode: result?.serviceControl?.payloadMode || result?.bngSession?.payloadMode || null,
    disconnectReason: result?.serviceControl?.reason || result?.bngSession?.reason || null,
    disconnectError: result?.serviceControl?.error || result?.bngSession?.error || null,
    disconnectSessionHint: result?.serviceControl?.sessionHint || result?.bngSession?.sessionHint || null
  };
}

async function resolveServiceCandidate(preferredServiceId) {
  const candidates = [];
  const preferred = preferredServiceId ? await SubscriberService.findOne({ serviceId: preferredServiceId }) : null;
  if (preferred) {
    candidates.push(preferred);
  }
  const recentServices = await SubscriberService.find({
    radiusUsername: { $exists: true, $ne: null },
    customerId: { $exists: true, $ne: null },
    status: { $in: ["active", "suspended"] }
  })
    .sort({ updatedAt: -1 })
    .limit(20);
  for (const service of recentServices) {
    if (!candidates.some((item) => String(item._id) === String(service._id))) {
      candidates.push(service);
    }
  }

  for (const service of candidates) {
    const storedPassword = service.metadata?.radiusPassword;
    if (storedPassword) {
      return { service, password: storedPassword, passwordSource: "service_metadata" };
    }
    const snapshot = await radiusServiceManager.getSubscriberAccessSnapshot({
      serviceId: service.serviceId
    }).catch(() => null);
    const cleartextPassword = snapshot?.radcheck?.find((entry) => entry.attribute === "Cleartext-Password")?.value;
    if (cleartextPassword) {
      return { service, password: cleartextPassword, passwordSource: "radcheck" };
    }
  }

  return { service: candidates[0] || null, password: null, passwordSource: null };
}

await connectMongo();

async function main() {
  const serviceId = process.env.TEST_RADIUS_SERVICE_ID || "SVC-1001";
  const resolved = await resolveServiceCandidate(serviceId);
  const service = resolved.service;
  if (!service) {
    fail(`Subscriber service not found: ${serviceId} and no fallback service was available`);
  }

  const resolvedServiceId = service.serviceId;
  const username = process.env.TEST_RADIUS_USERNAME || service.radiusUsername;
  const password = process.env.TEST_RADIUS_PASSWORD || resolved.password;
  if (!username || !password) {
    fail("Radius test requires an existing username and password", {
      serviceId: resolvedServiceId,
      username,
      passwordSource: resolved.passwordSource
    });
  }

  const provisionResult = await radiusServiceManager.createSubscriberAccess({
    serviceId: resolvedServiceId,
    customerId: service.customerId,
    radiusUsername: username,
    radiusPassword: password,
    accessProfileCode: service.accessProfileCode,
    billingProfileCode: service.billingProfileCode,
    bngNodeCode: service.bngNodeCode,
    metadata: service.metadata || {}
  });
  const activeState = await radiusServiceManager.verifySubscriberAccessState({
    serviceId: resolvedServiceId,
    expectedState: "active"
  });
  if (!activeState.matchesExpectedState || !activeState.checks.hasCleartextPassword || activeState.checks.hasAuthTypeReject) {
    fail("Provision verify failed", {
      result: summarizeServiceControl(provisionResult),
      checks: activeState.checks
    });
  }
  pass(`Provision verified (${resolvedServiceId}/${resolved.passwordSource || "env"} -> ${JSON.stringify(summarizeServiceControl(provisionResult))})`);

  const suspendReason = process.env.TEST_RADIUS_SUSPEND_REASON || "Integration test suspend";
  const suspendResult = await radiusServiceManager.suspendSubscriberAccess({
    serviceId: resolvedServiceId,
    reason: suspendReason
  });
  const suspendedState = await radiusServiceManager.verifySubscriberAccessState({
    serviceId: resolvedServiceId,
    expectedState: "suspended",
    expectedReplyMessage: suspendReason
  });
  if (
    !suspendedState.matchesExpectedState ||
    !suspendedState.matchesExpectedReplyMessage ||
    !suspendedState.checks.hasAuthTypeReject
  ) {
    fail("Suspend verify failed", {
      result: summarizeServiceControl(suspendResult),
      checks: suspendedState.checks
    });
  }
  pass(`Suspend verified (${JSON.stringify(summarizeServiceControl(suspendResult))})`);

  const resumeResult = await radiusServiceManager.resumeSubscriberAccess({
    serviceId: resolvedServiceId
  });
  const resumedState = await radiusServiceManager.verifySubscriberAccessState({
    serviceId: resolvedServiceId,
    expectedState: "active"
  });
  if (!resumedState.matchesExpectedState || !resumedState.checks.hasCleartextPassword || resumedState.checks.hasAuthTypeReject) {
    fail("Resume verify failed", {
      result: summarizeServiceControl(resumeResult),
      checks: resumedState.checks
    });
  }
  pass(`Resume verified (${resolvedServiceId} -> ${JSON.stringify(summarizeServiceControl(resumeResult))})`);

  console.log("\nRADIUS automation summary:");
  console.log("- provision writes active radcheck/radreply state: OK");
  console.log("- suspend writes reject state and disconnect metadata: OK");
  console.log("- resume restores active access and disconnect metadata: OK");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "RADIUS module test failed");
});
