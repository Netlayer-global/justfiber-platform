import test from "node:test";
import assert from "node:assert/strict";

const { buildPppoeCredentials, buildWifiCredentials } = await import("../src/common/networkProvisioning.js");

test("buildPppoeCredentials uses jf- plus last 8 digits and fixed password", () => {
  assert.deepEqual(buildPppoeCredentials("CUST-1234567890"), {
    username: "jf-34567890",
    password: "123456"
  });
  assert.deepEqual(buildPppoeCredentials("42"), {
    username: "jf-00000042",
    password: "123456"
  });
});

test("buildWifiCredentials uses JustFiber SSIDs and Just@NNNN password format", () => {
  const wifi = buildWifiCredentials();
  assert.equal(wifi.ssid24, "JustFiber");
  assert.equal(wifi.ssid5, "JustFiber");
  assert.match(wifi.password, /^Just@\d{4}$/);
});
