import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.PORT = "8080";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";
process.env.REDIS_URL = "redis://127.0.0.1:6379";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ADMIN_CORS_ORIGIN = "*";
process.env.MOCK_EXTERNALS = "false";
process.env.GENIEACS_URL = "http://127.0.0.1:7557";
process.env.GENIEACS_USERNAME = "acs";
process.env.GENIEACS_PASSWORD = "acs123";

const requests = [];
global.fetch = async (url, options = {}) => {
  requests.push({
    url: String(url),
    method: options.method || "GET",
    body: options.body ? JSON.parse(options.body) : undefined
  });

  if (String(url).includes("/devices?query=")) {
    return {
      ok: true,
      text: async () => JSON.stringify([{ _id: "240B88-G%2D2425G%2DA-ALCLB3DCCB87" }])
    };
  }

  return {
    ok: true,
    text: async () => JSON.stringify({ ok: true })
  };
};

const { GenieacsClient } = await import("../src/integrations/genieacsClient.js");

test("nokia wifi password update uses direct KeyPassphrase paths without xsd:string tuples", async () => {
  requests.length = 0;
  const client = new GenieacsClient();

  await client.pushAccessConfig({
    deviceId: "ALCLB3DCCB87",
    brand: "nokia",
    wifiPassword24: "himanshu@1411",
    wifiPassword5: "himanshu@1411"
  });

  const setParameterRequest = requests.find((entry) => entry.body?.name === "setParameterValues");
  assert.ok(setParameterRequest, "expected setParameterValues request");
  assert.deepEqual(setParameterRequest.body.parameterValues, [
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase", "himanshu@1411"],
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase", "himanshu@1411"]
  ]);
  assert.match(
    setParameterRequest.url,
    /\/devices\/240B88-G%252D2425G%252DA-ALCLB3DCCB87\/tasks(?:\?connection_request)?$/
  );
});

test("dasan wifi update pushes both SSIDs and both passwords to all expected WLAN indexes", async () => {
  requests.length = 0;
  const client = new GenieacsClient();

  await client.pushAccessConfig({
    deviceId: "DSNW295B5B70",
    brand: "dasan",
    ssid24: "Khalsa PG",
    ssid5: "Honey5G",
    wifiPassword24: "himanshu@1411",
    wifiPassword5: "himanshu@1411"
  });

  const setParameterRequest = requests.find((entry) => entry.body?.name === "setParameterValues");
  assert.ok(setParameterRequest, "expected setParameterValues request");
  assert.deepEqual(setParameterRequest.body.parameterValues, [
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", "Khalsa PG"],
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID", "Khalsa PG"],
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase", "himanshu@1411"],
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase", "himanshu@1411"],
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID", "Honey5G"],
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.SSID", "Honey5G"],
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.KeyPassphrase", "himanshu@1411"],
    ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.KeyPassphrase", "himanshu@1411"]
  ]);
});

test("dasan access config includes PPPoE username, PPPoE password, and NAT flag", async () => {
  requests.length = 0;
  const client = new GenieacsClient();

  await client.pushAccessConfig({
    deviceId: "DSNW295B5B70",
    brand: "dasan",
    pppoeUsername: "newuser@justfiber.in",
    pppoePassword: "NewPPPoEPass123",
    natEnabled: true
  });

  const setParameterRequest = requests.find((entry) => entry.body?.name === "setParameterValues");
  assert.ok(setParameterRequest, "expected setParameterValues request");
  assert.deepEqual(setParameterRequest.body.parameterValues, [
    ["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username", "newuser@justfiber.in"],
    ["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Username", "newuser@justfiber.in"],
    ["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password", "NewPPPoEPass123"],
    ["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Password", "NewPPPoEPass123"],
    ["Device.NAT.Enable", true, "xsd:boolean"],
    ["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.NATEnabled", true, "xsd:boolean"],
    ["Device.IP.Interface.1.NAT", true, "xsd:boolean"]
  ]);
});
