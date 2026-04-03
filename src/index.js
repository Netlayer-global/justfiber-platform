import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectMongo, getMongoError, isMongoConnected } from "./db/mongoose.js";
import { seedSystemData } from "./bootstrap/seedSystem.js";
import { env } from "./config/env.js";

await connectMongo();

if (isMongoConnected()) {
  try {
    await seedSystemData();
  } catch (err) {
    console.warn("[STARTUP] Seed data failed:", err.message);
  }
} else {
  console.warn("[STARTUP] Skipping seed data - MongoDB not connected");
}

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`Admin API listening on port ${env.PORT}`);
  if (getMongoError()) {
    console.warn("[STARTUP] WARNING: MongoDB unavailable - running in degraded mode");
  }
});
