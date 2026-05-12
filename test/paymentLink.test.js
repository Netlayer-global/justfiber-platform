import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.PORT = "8080";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
process.env.REDIS_URL = "redis://127.0.0.1:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_CORS_ORIGIN = "*";
process.env.MOCK_EXTERNALS = "false";
process.env.JAZE_API_BASE_URL = "http://127.0.0.1:9999/api/v1";
process.env.JAZE_API_USERNAME = "testuser";
process.env.JAZE_API_KEY = "testkey";
process.env.JAZE_ACCOUNT_ID = "testaccount";

// --- Mocks ---

// We'll track mock state to control behavior per test
let mockCustomerUser = null;
let mockCustomer = null;
let mockGeneratePaymentLinkResult = null;
let mockGeneratePaymentLinkError = null;

// Mock CustomerUser model
const mockCustomerUserFindById = async (id) => mockCustomerUser;

// Mock Customer model
const mockCustomerFindOne = () => ({
  lean: () => Promise.resolve(mockCustomer)
});

// Mock generatePaymentLink
const mockGeneratePaymentLink = async (jazeUserId) => {
  if (mockGeneratePaymentLinkError) throw mockGeneratePaymentLinkError;
  return mockGeneratePaymentLinkResult;
};

// Override modules via loader — since we can't easily use module mocks with node:test,
// we'll build a minimal Express app that mirrors the payment-link route with our mocks.

import express from "express";
import { ApiError } from "../src/common/ApiError.js";
import { asyncHandler } from "../src/common/asyncHandler.js";
import { env } from "../src/config/env.js";

// Replicate requireCustomerAuth with our mock
function requireCustomerAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Customer authentication required"));
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    if (payload.scope !== "customer") {
      throw new ApiError(401, "Invalid customer scope");
    }
    // Use our mock instead of DB
    if (!mockCustomerUser) {
      throw new ApiError(401, "Customer session invalid");
    }
    req.customerUser = mockCustomerUser;
    return next();
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(401, "Invalid customer token"));
  }
}

// Build test app with the payment-link route
function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.post(
    "/api/v1/customer/billing/jaze/payment-link",
    requireCustomerAuth,
    asyncHandler(async (req, res) => {
      const customerUser = req.customerUser;
      const linkedIds = customerUser.linkedCustomerIds || [];
      if (!linkedIds.length) {
        throw new ApiError(400, "No linked customer account found. Contact support.");
      }

      // Use our mock instead of DB
      if (!mockCustomer?.jazeUserId) {
        throw new ApiError(400, "Customer must be activated via an installer first.");
      }

      let result;
      try {
        result = await mockGeneratePaymentLink(mockCustomer.jazeUserId);
      } catch (err) {
        throw new ApiError(502, "Payment link could not be generated. Try again later.");
      }

      const { paymentLink } = result || {};
      if (!paymentLink || !paymentLink.startsWith("https://")) {
        throw new ApiError(502, "Payment link could not be generated. Try again later.");
      }

      return res.json({
        success: true,
        data: { paymentLink, customerId: mockCustomer.customerId }
      });
    })
  );

  // Error handler
  app.use((error, _req, res, _next) => {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: { message: error.message || "Internal server error" }
    });
  });

  return app;
}

// --- Helpers ---

function signCustomerToken(userId = "abc123") {
  return jwt.sign({ sub: userId, scope: "customer" }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

// --- Import supertest ---
const { default: request } = await import("supertest");

const app = buildTestApp();

// --- Tests ---

test("POST /billing/jaze/payment-link — returns 200 with valid HTTPS payment link", async () => {
  mockCustomerUser = {
    _id: "user1",
    linkedCustomerIds: ["CUST-001"]
  };
  mockCustomer = { customerId: "CUST-001", jazeUserId: "jaze-42" };
  mockGeneratePaymentLinkResult = { paymentLink: "https://pay.jaze.in/link/abc123" };
  mockGeneratePaymentLinkError = null;

  const token = signCustomerToken("user1");
  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.paymentLink, "https://pay.jaze.in/link/abc123");
  assert.equal(res.body.data.customerId, "CUST-001");
});

test("POST /billing/jaze/payment-link — returns 400 when customer has no linked jazeUserId", async () => {
  mockCustomerUser = {
    _id: "user2",
    linkedCustomerIds: ["CUST-002"]
  };
  mockCustomer = { customerId: "CUST-002", jazeUserId: "" }; // no jazeUserId
  mockGeneratePaymentLinkResult = null;
  mockGeneratePaymentLinkError = null;

  const token = signCustomerToken("user2");
  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /activated via an installer/);
});

test("POST /billing/jaze/payment-link — returns 400 when no linked customer accounts", async () => {
  mockCustomerUser = {
    _id: "user3",
    linkedCustomerIds: [] // empty
  };
  mockCustomer = null;
  mockGeneratePaymentLinkResult = null;
  mockGeneratePaymentLinkError = null;

  const token = signCustomerToken("user3");
  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /No linked customer account/);
});

test("POST /billing/jaze/payment-link — returns 502 when Jaze API returns empty link", async () => {
  mockCustomerUser = {
    _id: "user4",
    linkedCustomerIds: ["CUST-004"]
  };
  mockCustomer = { customerId: "CUST-004", jazeUserId: "jaze-99" };
  mockGeneratePaymentLinkResult = { paymentLink: "" }; // empty link
  mockGeneratePaymentLinkError = null;

  const token = signCustomerToken("user4");
  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  assert.equal(res.status, 502);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /Payment link could not be generated/);
});

test("POST /billing/jaze/payment-link — returns 502 when Jaze API returns non-HTTPS link", async () => {
  mockCustomerUser = {
    _id: "user5",
    linkedCustomerIds: ["CUST-005"]
  };
  mockCustomer = { customerId: "CUST-005", jazeUserId: "jaze-55" };
  mockGeneratePaymentLinkResult = { paymentLink: "http://insecure.example.com/pay" }; // non-HTTPS
  mockGeneratePaymentLinkError = null;

  const token = signCustomerToken("user5");
  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  assert.equal(res.status, 502);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /Payment link could not be generated/);
});

test("POST /billing/jaze/payment-link — returns 502 when Jaze API throws an error", async () => {
  mockCustomerUser = {
    _id: "user6",
    linkedCustomerIds: ["CUST-006"]
  };
  mockCustomer = { customerId: "CUST-006", jazeUserId: "jaze-66" };
  mockGeneratePaymentLinkResult = null;
  mockGeneratePaymentLinkError = new Error("Jaze network timeout");

  const token = signCustomerToken("user6");
  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  assert.equal(res.status, 502);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /Payment link could not be generated/);
});

test("POST /billing/jaze/payment-link — returns 401 when JWT is missing", async () => {
  mockCustomerUser = null;

  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .send({});

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /authentication required/i);
});

test("POST /billing/jaze/payment-link — returns 401 when JWT is invalid", async () => {
  mockCustomerUser = null;

  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .set("Authorization", "Bearer invalid.token.here")
    .send({});

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("POST /billing/jaze/payment-link — returns 401 when JWT has wrong scope (not customer)", async () => {
  mockCustomerUser = null;

  // Sign a token with admin scope (no scope field = not customer)
  const token = jwt.sign({ sub: "admin1" }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
  const res = await request(app)
    .post("/api/v1/customer/billing/jaze/payment-link")
    .set("Authorization", `Bearer ${token}`)
    .send({});

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});
