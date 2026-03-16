import crypto from "node:crypto";

export function requestContext(req, res, next) {
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.correlationId = req.headers["x-correlation-id"] || req.requestId;
  res.setHeader("x-request-id", req.requestId);
  res.setHeader("x-correlation-id", req.correlationId);
  next();
}
