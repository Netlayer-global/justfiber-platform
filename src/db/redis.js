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
        lazyConnect: true,
        retryStrategy: () => null,
        reconnectOnError: () => false,
        showFriendlyErrorStack: false
      });

      connection.on("error", () => {
        connectionError = true;
      });

      connection.on("connect", () => {
        connectionError = null;
      });

      connection.connect().catch(() => {
        connectionError = true;
      });
    } catch (err) {
      connectionError = true;
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
