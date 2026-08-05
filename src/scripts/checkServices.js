import { connectMongo } from "../db/mongoose.js";
import { SubscriberService } from "../models/SubscriberService.js";

async function main() {
  await connectMongo();
  const services = await SubscriberService.find({});
  console.log(`Found ${services.length} services:`);
  services.forEach(s => {
    console.log(`- Service ID: ${s.serviceId}, CustID: ${s.customerId}, Username: ${s.radiusUsername}, Status: ${s.status}`);
  });
  process.exit(0);
}

main().catch(console.error);
