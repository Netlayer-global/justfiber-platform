import Redis from "ioredis";
import { env } from "../config/env.js";

let connection;

export function getRedisConnection() {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null
    });
  }
  return connection;
}
