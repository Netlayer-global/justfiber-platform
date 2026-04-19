import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
process.env.REDIS_URL = "redis://127.0.0.1:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_CORS_ORIGIN = "*";
process.env.MOCK_EXTERNALS = "true";

const { adminCanAccessAllZones, assertAdminZoneAccess, assertMainAdminAccess } = await import("../src/common/auth.js");

test("adminCanAccessAllZones is explicit and does not unlock by permission-shaped roles", () => {
  assert.equal(adminCanAccessAllZones({ roles: ["ops_admin"], zoneCode: "zone-a" }), false);
  assert.equal(adminCanAccessAllZones({ roles: ["admin_user_manage"], zoneCode: "zone-a" }), false);
  assert.equal(adminCanAccessAllZones({ roles: ["super_admin"], zoneCode: "zone-a" }), true);
  assert.equal(adminCanAccessAllZones({ roles: ["ops_admin"], zoneCode: "", canAccessAllZones: false }), true);
  assert.equal(adminCanAccessAllZones({ roles: ["ops_admin"], zoneCode: "zone-a", canAccessAllZones: true }), true);
});

test("assertAdminZoneAccess forces assigned zone for sub-zone admins", () => {
  const admin = { roles: ["ops_admin"], zoneCode: "zone-a", zoneName: "Zone A" };

  assert.equal(assertAdminZoneAccess(admin, ""), "zone-a");
  assert.equal(assertAdminZoneAccess(admin, "zone-a"), "zone-a");
  assert.equal(assertAdminZoneAccess(admin, "ZONE-A"), "zone-a");

  assert.throws(
    () => assertAdminZoneAccess(admin, "zone-b"),
    (error) => error?.statusCode === 403 && error?.message === "Zone access denied"
  );
});

test("assertAdminZoneAccess allows main admins to request any zone", () => {
  assert.equal(assertAdminZoneAccess({ roles: ["super_admin"], zoneCode: "zone-a" }, "zone-b"), "zone-b");
  assert.equal(assertAdminZoneAccess({ roles: ["ops_admin"], canAccessAllZones: true, zoneCode: "zone-a" }, "zone-b"), "zone-b");
});

test("assertMainAdminAccess blocks sub-zone governance mutations", () => {
  assert.doesNotThrow(() => assertMainAdminAccess({ roles: ["super_admin"], zoneCode: "zone-a" }));
  assert.doesNotThrow(() => assertMainAdminAccess({ roles: ["ops_admin"], canAccessAllZones: true, zoneCode: "zone-a" }));

  assert.throws(
    () => assertMainAdminAccess({ roles: ["ops_admin"], zoneCode: "zone-a" }),
    (error) => error?.statusCode === 403 && error?.message === "Only main admin can manage zones"
  );
});
