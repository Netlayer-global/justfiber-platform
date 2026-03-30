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
    disconnectReason: result?.serviceControl?.reason || result?.bngSession?.reason || null,
    disconnectError: result?.serviceControl?.error || result?.bngSession?.error || null
  };
}

await connectMongo();

async function main() {
  const serviceId = process.env.TEST_RADIUS_SERVICE_ID || "SVC-1001";
  const service = await SubscriberService.findOne({ serviceId });
  if (!service) {
    fail(`Subscriber service not found: ${serviceId}`);
  }

  const username = process.env.TEST_RADIUS_USERNAME || service.radiusUsername;
  const password = process.env.TEST_RADIUS_PASSWORD || service.metadata?.radiusPassword;
  if (!username || !password) {
    fail("Radius test requires an existing username and password");
  }

  const provisionResult = await radiusServiceManager.createSubscriberAccess({
    serviceId,
    customerId: service.customerId,
    radiusUsername: username,
    radiusPassword: password,
    accessProfileCode: service.accessProfileCode,
    billingProfileCode: service.billingProfileCode,
    bngNodeCode: service.bngNodeCode,
    metadata: service.metadata || {}
  });
  const activeState = await radiusServiceManager.verifySubscriberAccessState({
    serviceId,
    expectedState: "active"
  });
  if (!activeState.matchesExpectedState || !activeState.checks.hasCleartextPassword || activeState.checks.hasAuthTypeReject) {
    fail("Provision verify failed", {
      result: summarizeServiceControl(provisionResult),
      checks: activeState.checks
    });
  }
  pass(`Provision verified (${JSON.stringify(summarizeServiceControl(provisionResult))})`);

  const suspendReason = process.env.TEST_RADIUS_SUSPEND_REASON || "Integration test suspend";
  const suspendResult = await radiusServiceManager.suspendSubscriberAccess({
    serviceId,
    reason: suspendReason
  });
  const suspendedState = await radiusServiceManager.verifySubscriberAccessState({
    serviceId,
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
    serviceId
  });
  const resumedState = await radiusServiceManager.verifySubscriberAccessState({
    serviceId,
    expectedState: "active"
  });
  if (!resumedState.matchesExpectedState || !resumedState.checks.hasCleartextPassword || resumedState.checks.hasAuthTypeReject) {
    fail("Resume verify failed", {
      result: summarizeServiceControl(resumeResult),
      checks: resumedState.checks
    });
  }
  pass(`Resume verified (${JSON.stringify(summarizeServiceControl(resumeResult))})`);

  console.log("\nRADIUS automation summary:");
  console.log("- provision writes active radcheck/radreply state: OK");
  console.log("- suspend writes reject state and disconnect metadata: OK");
  console.log("- resume restores active access and disconnect metadata: OK");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "RADIUS module test failed");
});
