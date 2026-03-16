import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.PORT = "8080";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
process.env.REDIS_URL = "redis://127.0.0.1:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_CORS_ORIGIN = "*";
process.env.MOCK_EXTERNALS = "true";

const { createApp } = await import("../src/app.js");

test("live health endpoint responds", async () => {
  const app = createApp();
  const response = await request(app).get("/health/live");
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "live");
});

test("missing route returns 404 envelope", async () => {
  const app = createApp();
  const response = await request(app).get("/missing");
  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
});

test("admin frontend entrypoint responds", async () => {
  const app = createApp();
  const response = await request(app).get("/admin");
  assert.equal(response.status, 200);
  assert.match(response.text, /Netlayer Control Tower/);
});

test("user frontend entrypoint responds", async () => {
  const app = createApp();
  const response = await request(app).get("/user");
  assert.equal(response.status, 200);
  assert.match(response.text, /Justfiber User Panel/);
});

test("sales frontend entrypoint responds", async () => {
  const app = createApp();
  const response = await request(app).get("/sales");
  assert.equal(response.status, 200);
  assert.match(response.text, /Justfiber Sales/);
});

test("noc frontend entrypoint responds", async () => {
  const app = createApp();
  const response = await request(app).get("/noc");
  assert.equal(response.status, 200);
  assert.match(response.text, /Netlayer Control Tower/);
});
