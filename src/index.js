import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectMongo } from "./db/mongoose.js";
import { seedSystemData } from "./bootstrap/seedSystem.js";
import { env } from "./config/env.js";

await connectMongo();
await seedSystemData();

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`Admin API listening on port ${env.PORT}`);
});
