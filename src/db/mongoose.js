import mongoose from "mongoose";
import { env } from "../config/env.js";

let connected = false;
let connectionError = null;

export async function connectMongo() {
  if (connected || connectionError) {
    return mongoose.connection;
  }
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000
    });
    connected = true;
    console.log("[DB] MongoDB connected successfully");
    return mongoose.connection;
  } catch (err) {
    connectionError = err;
    console.warn("[DB] MongoDB connection failed - running in degraded mode");
    return null;
  }
}

export function isMongoConnected() {
  return connected && mongoose.connection.readyState === 1;
}

export function getMongoError() {
  return connectionError;
}
