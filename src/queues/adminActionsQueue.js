import { Queue } from "bullmq";
import { getRedisConnection } from "../db/redis.js";

export const adminActionsQueue = new Queue("admin-actions", {
  connection: getRedisConnection()
});
