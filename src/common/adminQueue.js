import { Queue } from "bullmq";
import { getRedisConnection, isRedisAvailable } from "../db/redis.js";

let queue;
let queueInitialized = false;

export function getAdminQueue() {
  if (!queueInitialized) {
    try {
      const redis = getRedisConnection();
      if (redis) {
        queue = new Queue("admin-actions", {
          connection: redis
        });
        queueInitialized = true;
      }
    } catch (err) {
      console.warn("[QUEUE] Failed to initialize admin queue:", err.message);
      queueInitialized = true;
    }
  }
  return queue;
}

export async function addAdminJob(name, data, opts = {}) {
  try {
    if (!isRedisAvailable()) {
      console.warn("[QUEUE] Redis not available, job will not be queued:", name);
      return { id: null, success: false, reason: "Redis unavailable" };
    }
    const adminQueue = getAdminQueue();
    if (!adminQueue) {
      console.warn("[QUEUE] Admin queue not initialized, skipping job:", name);
      return { id: null, success: false, reason: "Queue not initialized" };
    }
    return await adminQueue.add(name, data, opts);
  } catch (err) {
    console.error("[QUEUE] Failed to add job:", name, err.message);
    return { id: null, success: false, reason: err.message };
  }
}
