import { Queue } from "bullmq";
import { getRedisConnection } from "../db/redis.js";

let queue;

export function getAdminQueue() {
  if (!queue) {
    queue = new Queue("admin-actions", {
      connection: getRedisConnection()
    });
  }
  return queue;
}

export async function addAdminJob(name, data, opts = {}) {
  const adminQueue = getAdminQueue();
  return adminQueue.add(name, data, opts);
}
