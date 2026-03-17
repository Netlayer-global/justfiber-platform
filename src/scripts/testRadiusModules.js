import { connectMongo } from "../db/mongoose.js";
import { radiusServiceManager } from "../integrations/radiusServiceManager.js";
import { SubscriberService } from "../models/SubscriberService.js";

await connectMongo();

async function main() {
  const serviceId = process.env.TEST_RADIUS_SERVICE_ID || "SVC-1001";
  const username = process.env.TEST_RADIUS_USERNAME || "JustFiber";
  const password = process.env.TEST_RADIUS_PASSWORD || "Netlayer@141195";

  const service = await SubscriberService.findOne({ serviceId });
  if (!service) {
    throw new Error(`Subscriber service not found: ${serviceId}`);
  }

  await radiusServiceManager.createSubscriberAccess({
    serviceId,
    customerId: service.customerId,
    radiusUsername: username,
    radiusPassword: password,
    accessProfileCode: service.accessProfileCode,
    billingProfileCode: service.billingProfileCode,
    bngNodeCode: service.bngNodeCode
  });
  console.log("Provision: OK");

  await radiusServiceManager.suspendSubscriberAccess({
    serviceId,
    reason: "Integration test suspend"
  });
  console.log("Suspend: OK");

  await radiusServiceManager.resumeSubscriberAccess({
    serviceId
  });
  console.log("Resume: OK");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
