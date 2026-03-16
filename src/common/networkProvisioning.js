const BRAND_PATTERNS = [
  { brand: "nokia", patterns: ["nokia", "g-2425", "g2425", "alcl"] },
  { brand: "dasan", patterns: ["dasan", "h660", "h640"] },
  { brand: "zte", patterns: ["zte", "f6", "zxhn"] },
  { brand: "syrotech", patterns: ["syrotech", "sy-gpon"] },
  { brand: "tp-link", patterns: ["tp-link", "tplink", "xc220"] },
  { brand: "secureeye", patterns: ["secureeye"] },
  { brand: "gx", patterns: ["gx", "gpon"] },
  { brand: "zyxel", patterns: ["zyxel", "pmg", "ex"] }
];

export function normalizeCustomerId(value) {
  return String(value || "").trim();
}

export function buildPppoeCredentials(customerId) {
  const normalized = normalizeCustomerId(customerId);
  const safeId = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    username: `jfr_${safeId || "customer"}`,
    password: "123456"
  };
}

export function buildWifiCredentials() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 8; i += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return {
    ssid24: "JustFiber",
    ssid5: "JustFiber",
    password
  };
}

export function detectOntBrand({ serialNumber, productClass, deviceId }) {
  const haystack = `${serialNumber || ""} ${productClass || ""} ${deviceId || ""}`.toLowerCase();
  for (const entry of BRAND_PATTERNS) {
    if (entry.patterns.some((pattern) => haystack.includes(pattern))) {
      return entry.brand;
    }
  }
  return "generic";
}

export function resolveProvisioningProfile(brand) {
  const generic = {
    pppoeUsernamePath: "Device.WAN.PPPConnection.1.Username",
    pppoePasswordPath: "Device.WAN.PPPConnection.1.Password",
    vlanPath: "Device.WAN.Ethernet.1.VLANID",
    natPath: "Device.NAT.Enable",
    ssid24Path: "Device.WiFi.SSID.1.SSID",
    pass24Path: "Device.WiFi.AccessPoint.1.Security.KeyPassphrase",
    ssid5Path: "Device.WiFi.SSID.5.SSID",
    pass5Path: "Device.WiFi.AccessPoint.5.Security.KeyPassphrase"
  };

  const overrides = {
    "tp-link": {
      pppoeUsernamePath: "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username",
      pppoePasswordPath: "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password",
      vlanPath: "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_TP_VLANID",
      natPath: "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.NATEnabled",
      ssid24Path: "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
      pass24Path: "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
      ssid5Path: "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID",
      pass5Path: "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase"
    }
  };

  return {
    ...generic,
    ...(overrides[brand] || {})
  };
}
