import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { getRedisConnection } from "../db/redis.js";

export const adminActionsQueue = env.NODE_ENV === "test"
  ? {
      async add(name, data, opts = {}) {
        return { id: null, name, data, opts, skipped: true, reason: "Queue disabled in test" };
      }
    }
  : new Queue("admin-actions", {
      connection: getRedisConnection()
    });
