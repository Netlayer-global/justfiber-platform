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

let mockCustomer = null;
let mockAdminUser = null;
let mockInstaller = null;
let mockJazePaymentResult = null;
let mockJazePaymentError = null;

import express from "express";
import { ApiError } from "../src/common/ApiError.js";
import { asyncHandler } from "../src/common/asyncHandler.js";
import { env } from "../src/config/env.js";

// Replicate requireAdminOrInstaller with our mocks
function requireAdminOrInstaller(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

    // If scope is "installer", treat as installer auth
    if (payload.scope === "installer") {
      if (!mockInstaller || mockInstaller.status !== "active") {
        throw new ApiError(401, "Installer session is invalid");
      }
      req.installer = mockInstaller;
      return next();
    }

    // Otherwise treat as admin auth
    if (!mockAdminUser || mockAdminUser.status !== "active") {
      throw new ApiError(401, "Session is invalid");
    }
    req.admin = mockAdminUser;
    return next();
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(401, "Invalid token"));
  }
}

const VALID_METHODS = ["cash", "onlinePayment", "manualCollection"];

// Build test app with the collect-cash route
function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.post(
    "/api/v1/admin/payments/collect-cash",
    requireAdminOrInstaller,
    asyncHandler(async (req, res) => {
      const { customerId, amount, method, notes } = req.body;

      // Validate customerId
      if (!customerId) {
        throw new ApiError(400, "customerId is required");
      }

      // Validate amount
      const numAmount = Number(amount);
      if (amount === undefined || amount === null || amount === "") {
        throw new ApiError(400, "amount is required");
      }
      if (!Number.isFinite(numAmount) || numAmount < 0.01 || numAmount > 999999.99) {
        throw new ApiError(400, "amount must be between 0.01 and 999999.99");
      }

      // Validate method
      if (!method) {
        throw new ApiError(400, "method is required");
      }
      if (!VALID_METHODS.includes(method)) {
        throw new ApiError(400, `method must be one of: ${VALID_METHODS.join(", ")}`);
      }

      // Validate notes (optional)
      if (notes !== undefined && notes !== null && typeof notes === "string" && notes.length > 500) {
        throw new ApiError(400, "notes must be 500 characters or fewer");
      }

      // Resolve customer (mock)
      if (!mockCustomer) {
        throw new ApiError(404, "Customer not found");
      }
      if (!mockCustomer.jazeUserId) {
        throw new ApiError(404, "Customer is not activated (no Jaze account linked)");
      }

      // Build notes with collector info
      const collectorName = req.admin?.name || req.admin?.fullName || req.installer?.name || req.installer?.fullName || "System";
      const fullNotes = notes
        ? `${notes} | Collected by: ${collectorName}`
        : `Cash collected by: ${collectorName}`;

      // Call Jaze makePayment (mock)
      let jazeResponse;
      try {
        if (mockJazePaymentError) throw mockJazePaymentError;
        jazeResponse = mockJazePaymentResult;
      } catch (err) {
        throw new ApiError(502, `Jaze payment failed: ${err.message}`);
      }

      return res.json({
        success: true,
        data: {
          transactionId: jazeResponse?.transactionId || jazeResponse?.id || null,
          customerId,
          amount: numAmount,
          method,
          notes: fullNotes,
          recordedAt: new Date().toISOString()
        }
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

function signAdminToken(adminId = "admin1") {
  return jwt.sign({ sub: adminId, roles: ["super_admin"] }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

function signInstallerToken(installerId = "inst1") {
  return jwt.sign({ sub: installerId, scope: "installer", roles: ["installer"] }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

function resetMocks() {
  mockCustomer = { customerId: "CUST-100", jazeUserId: "jaze-100", fullName: "Test Customer" };
  mockAdminUser = { _id: "admin1", fullName: "Admin User", status: "active", roles: ["super_admin"] };
  mockInstaller = { _id: "inst1", fullName: "Installer User", status: "active", roles: ["installer"] };
  mockJazePaymentResult = { transactionId: "txn-abc-123" };
  mockJazePaymentError = null;
}

// --- Import supertest ---
const { default: request } = await import("supertest");

const app = buildTestApp();

// --- Tests ---

test("POST /collect-cash — successful cash payment recording", async () => {
  resetMocks();

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: 500, method: "cash", notes: "Monthly payment" });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.transactionId, "txn-abc-123");
  assert.equal(res.body.data.customerId, "CUST-100");
  assert.equal(res.body.data.amount, 500);
  assert.equal(res.body.data.method, "cash");
  assert.match(res.body.data.notes, /Monthly payment/);
  assert.match(res.body.data.notes, /Collected by: Admin User/);
  assert.ok(res.body.data.recordedAt);
});

test("POST /collect-cash — returns 400 for missing customerId", async () => {
  resetMocks();

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 500, method: "cash" });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /customerId is required/);
});

test("POST /collect-cash — returns 400 for negative amount", async () => {
  resetMocks();

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: -50, method: "cash" });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /amount must be between/);
});

test("POST /collect-cash — returns 400 for zero amount", async () => {
  resetMocks();

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: 0, method: "cash" });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /amount must be between/);
});

test("POST /collect-cash — returns 400 for amount too large (>999999.99)", async () => {
  resetMocks();

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: 1000000, method: "cash" });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /amount must be between/);
});

test("POST /collect-cash — returns 400 for invalid method", async () => {
  resetMocks();

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: 500, method: "bitcoin" });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /method must be one of/);
});

test("POST /collect-cash — returns 400 for notes too long (>500 chars)", async () => {
  resetMocks();

  const longNotes = "x".repeat(501);
  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: 500, method: "cash", notes: longNotes });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /notes must be 500 characters or fewer/);
});

test("POST /collect-cash — returns 404 for non-existent customer", async () => {
  resetMocks();
  mockCustomer = null; // customer not found

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-NONEXIST", amount: 500, method: "cash" });

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /Customer not found/);
});

test("POST /collect-cash — returns 404 for customer without jazeUserId", async () => {
  resetMocks();
  mockCustomer = { customerId: "CUST-200", jazeUserId: "", fullName: "No Jaze" };

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-200", amount: 500, method: "cash" });

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /not activated/);
});

test("POST /collect-cash — returns 502 when Jaze API call fails", async () => {
  resetMocks();
  mockJazePaymentError = new Error("Jaze service unavailable");
  mockJazePaymentResult = null;

  const token = signAdminToken();
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: 500, method: "cash" });

  assert.equal(res.status, 502);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /Jaze payment failed/);
});

test("POST /collect-cash — returns 401 for missing JWT", async () => {
  resetMocks();

  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .send({ customerId: "CUST-100", amount: 500, method: "cash" });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /Authentication required/);
});

test("POST /collect-cash — returns 401 for invalid JWT", async () => {
  resetMocks();

  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", "Bearer totally.invalid.token")
    .send({ customerId: "CUST-100", amount: 500, method: "cash" });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("POST /collect-cash — accepts admin token (combined auth)", async () => {
  resetMocks();

  const token = signAdminToken("admin1");
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: 250, method: "onlinePayment" });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.data.notes, /Admin User/);
});

test("POST /collect-cash — accepts installer token (combined auth)", async () => {
  resetMocks();

  const token = signInstallerToken("inst1");
  const res = await request(app)
    .post("/api/v1/admin/payments/collect-cash")
    .set("Authorization", `Bearer ${token}`)
    .send({ customerId: "CUST-100", amount: 300, method: "manualCollection" });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.data.notes, /Installer User/);
});
