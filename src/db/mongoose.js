import mongoose from "mongoose";
import { env } from "../config/env.js";

let connected = false;

export async function connectMongo() {
  if (connected) {
    return mongoose.connection;
  }
  await mongoose.connect(env.MONGODB_URI);
  connected = true;
  return mongoose.connection;
}
