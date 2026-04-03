import Redis from "ioredis";
import { env } from "../config/env.js";

let connection;
let connectionError;

export function getRedisConnection() {
  if (!connection) {
    try {
      connection = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        enableOfflineQueue: true,
        retryStrategy: (times) => {
          if (times > 3) {
            connectionError = new Error("Redis connection failed after 3 retries - Redis may not be running");
            console.warn("[REDIS] Connection failed, queue operations will be disabled:", connectionError.message);
            return null;
          }
          return Math.min(times * 50, 500);
        }
      });

      connection.on("error", (err) => {
        if (!connectionError) {
          connectionError = err;
          console.warn("[REDIS] Connection error:", err.message);
        }
      });

      connection.on("connect", () => {
        connectionError = null;
        console.log("[REDIS] Connected successfully");
      });
    } catch (err) {
      connectionError = err;
      console.warn("[REDIS] Failed to initialize:", err.message);
    }
  }
  return connection;
}

export function isRedisAvailable() {
  return connection && connection.status === "ready" && !connectionError;
}

export function getRedisError() {
  return connectionError;
}
