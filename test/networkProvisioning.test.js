import test from "node:test";
import assert from "node:assert/strict";

const { buildPppoeCredentials, buildWifiCredentials } = await import("../src/common/networkProvisioning.js");

test("buildPppoeCredentials uses fixed customer based _wifi username and fixed password", () => {
  assert.deepEqual(buildPppoeCredentials("CUST-1234567890"), {
    username: "123450175_wifi",
    password: "123456"
  });
  assert.deepEqual(buildPppoeCredentials("42"), {
    username: "004232429_wifi",
    password: "123456"
  });
});

test("buildWifiCredentials uses deterministic JustFiber SSIDs and just@NNNN password format", () => {
  const wifi = buildWifiCredentials({}, "CUST-1234567890");
  assert.equal(wifi.ssid24, "JustFiber_0709");
  assert.equal(wifi.ssid5, "JustFiber_0709");
  assert.equal(wifi.password, "just@8670");
});
