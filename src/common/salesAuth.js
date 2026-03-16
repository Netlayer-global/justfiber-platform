import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";
import { SalesAgent } from "../models/SalesAgent.js";

const sessions = new Map();

export function signSalesAccessToken(agent) {
  return jwt.sign({ sub: agent._id.toString(), scope: "sales" }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL
  });
}

export function signSalesRefreshToken(agent) {
  const token = jwt.sign({ sub: agent._id.toString(), scope: "sales" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL
  });
  sessions.set(agent._id.toString(), crypto.createHash("sha256").update(token).digest("hex"));
  return token;
}

export async function requireSalesAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Sales authentication required"));
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    if (payload.scope !== "sales") {
      throw new ApiError(401, "Invalid sales scope");
    }
    const agent = await SalesAgent.findById(payload.sub);
    if (!agent || agent.status !== "active") {
      throw new ApiError(401, "Sales agent invalid");
    }
    req.salesAgent = agent;
    return next();
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(401, "Invalid sales token"));
  }
}
