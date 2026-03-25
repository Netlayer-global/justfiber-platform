const BRAND_PATTERNS = [
  { brand: "nokia", patterns: ["nokia", "g-2425", "g2425", "g-140w", "g140w", "alcl", "alcatel"] },
  { brand: "dasan", patterns: ["dasan", "h660", "h640", "h665"] },
  { brand: "zte", patterns: ["zte", "f6", "zxhn", "f670", "f660", "f680"] },
  { brand: "syrotech", patterns: ["syrotech", "sy-gpon", "slt", "goxsq"] },
  { brand: "tp-link", patterns: ["tp-link", "tplink", "xc220", "xz000", "archer"] },
  { brand: "secureeye", patterns: ["secureeye", "se-", "sewifi"] },
  { brand: "gx", patterns: ["gx", "gpon", "gpononu", "g-ont"] },
  { brand: "zyxel", patterns: ["zyxel", "pmg", "ex", "px"] }
];

const IGD_PPP = "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1";
const IGD_WIFI_24 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1";
const IGD_WIFI_5 = "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5";
const DEVICE_PPP = "Device.PPP.Interface.1";
const DEVICE_IP = "Device.IP.Interface.1";
const DEVICE_WIFI_24 = "Device.WiFi.SSID.1";
const DEVICE_WIFI_5 = "Device.WiFi.SSID.5";
const DEVICE_AP_24 = "Device.WiFi.AccessPoint.1.Security";
const DEVICE_AP_5 = "Device.WiFi.AccessPoint.5.Security";

const GENERIC_PROFILE = {
  pppoeUsernamePath: [
    `${DEVICE_PPP}.Username`,
    "Device.WAN.PPPConnection.1.Username",
    `${IGD_PPP}.Username`
  ],
  pppoePasswordPath: [
    `${DEVICE_PPP}.Password`,
    "Device.WAN.PPPConnection.1.Password",
    `${IGD_PPP}.Password`
  ],
  vlanPath: [
    `${DEVICE_IP}.X_BROADCOM_COM_VLANIDMark`,
    "Device.WAN.Ethernet.1.VLANID",
    `${IGD_PPP}.X_CT-COM_VLANID`,
    `${IGD_PPP}.X_TP_VLANID`
  ],
  natPath: [
    "Device.NAT.Enable",
    `${IGD_PPP}.NATEnabled`,
    `${DEVICE_IP}.NAT`
  ],
  ssid24Path: [
    `${DEVICE_WIFI_24}.SSID`,
    `${IGD_WIFI_24}.SSID`
  ],
  pass24Path: [
    `${DEVICE_AP_24}.KeyPassphrase`,
    `${DEVICE_AP_24}.PreSharedKey.1.KeyPassphrase`,
    `${DEVICE_AP_24}.PreSharedKey.1.PreSharedKey`,
    `${IGD_WIFI_24}.KeyPassphrase`,
    `${IGD_WIFI_24}.PreSharedKey.1.KeyPassphrase`,
    `${IGD_WIFI_24}.PreSharedKey.1.PreSharedKey`
  ],
  ssid5Path: [
    `${DEVICE_WIFI_5}.SSID`,
    `${IGD_WIFI_5}.SSID`
  ],
  pass5Path: [
    `${DEVICE_AP_5}.KeyPassphrase`,
    `${DEVICE_AP_5}.PreSharedKey.1.KeyPassphrase`,
    `${DEVICE_AP_5}.PreSharedKey.1.PreSharedKey`,
    `${IGD_WIFI_5}.KeyPassphrase`,
    `${IGD_WIFI_5}.PreSharedKey.1.KeyPassphrase`,
    `${IGD_WIFI_5}.PreSharedKey.1.PreSharedKey`
  ]
};

const BRAND_OVERRIDES = {
  nokia: {
    pppoeUsernamePath: [
      `${IGD_PPP}.Username`,
      `${DEVICE_PPP}.Username`
    ],
    pppoePasswordPath: [
      `${IGD_PPP}.Password`,
      `${DEVICE_PPP}.Password`
    ],
    vlanPath: [
      `${IGD_PPP}.X_ALU_OntWAN.VlanId`,
      `${IGD_PPP}.X_CT-COM_VLANID`,
      "Device.WAN.Ethernet.1.VLANID"
    ],
    pass24Path: [
      `${IGD_WIFI_24}.KeyPassphrase`
    ],
    pass5Path: [
      `${IGD_WIFI_5}.KeyPassphrase`
    ]
  },
  dasan: {
    pppoeUsernamePath: [
      `${IGD_PPP}.Username`,
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Username"
    ],
    pppoePasswordPath: [
      `${IGD_PPP}.Password`,
      "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Password"
    ],
    vlanPath: [
      `${IGD_PPP}.X_DASAN_VLANID`,
      `${IGD_PPP}.X_CT-COM_VLANID`
    ],
    ssid24Path: [
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID"
    ],
    pass24Path: [
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase"
    ],
    ssid5Path: [
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID",
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.SSID"
    ],
    pass5Path: [
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.KeyPassphrase",
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.6.KeyPassphrase"
    ]
  },
  zte: {
    pppoeUsernamePath: [
      `${IGD_PPP}.Username`,
      `${DEVICE_PPP}.Username`
    ],
    pppoePasswordPath: [
      `${IGD_PPP}.Password`,
      `${DEVICE_PPP}.Password`
    ],
    vlanPath: [
      `${IGD_PPP}.X_ZTE-COM_VLANID`,
      `${IGD_PPP}.X_CT-COM_VLANID`
    ],
    natPath: [
      `${IGD_PPP}.NATEnabled`,
      "Device.NAT.Enable"
    ]
  },
  syrotech: {
    pppoeUsernamePath: [
      `${IGD_PPP}.Username`,
      `${DEVICE_PPP}.Username`
    ],
    pppoePasswordPath: [
      `${IGD_PPP}.Password`,
      `${DEVICE_PPP}.Password`
    ],
    vlanPath: [
      `${IGD_PPP}.X_SYROTECH_VLANID`,
      `${IGD_PPP}.X_CT-COM_VLANID`
    ]
  },
  "tp-link": {
    pppoeUsernamePath: [
      `${IGD_PPP}.Username`,
      `${DEVICE_PPP}.Username`
    ],
    pppoePasswordPath: [
      `${IGD_PPP}.Password`,
      `${DEVICE_PPP}.Password`
    ],
    vlanPath: [
      `${IGD_PPP}.X_TP_VLANID`,
      "Device.WAN.Ethernet.1.VLANID"
    ],
    natPath: [
      `${IGD_PPP}.NATEnabled`,
      "Device.NAT.Enable"
    ],
    ssid24Path: [
      `${IGD_WIFI_24}.SSID`,
      `${DEVICE_WIFI_24}.SSID`
    ],
    pass24Path: [
      `${IGD_WIFI_24}.PreSharedKey.1.KeyPassphrase`,
      `${DEVICE_AP_24}.KeyPassphrase`
    ],
    ssid5Path: [
      `${IGD_WIFI_5}.SSID`,
      `${DEVICE_WIFI_5}.SSID`
    ],
    pass5Path: [
      `${IGD_WIFI_5}.PreSharedKey.1.KeyPassphrase`,
      `${DEVICE_AP_5}.KeyPassphrase`
    ]
  },
  secureeye: {
    pppoeUsernamePath: [
      `${IGD_PPP}.Username`,
      `${DEVICE_PPP}.Username`
    ],
    pppoePasswordPath: [
      `${IGD_PPP}.Password`,
      `${DEVICE_PPP}.Password`
    ],
    vlanPath: [
      `${IGD_PPP}.X_SECUREEYE_VLANID`,
      `${IGD_PPP}.X_CT-COM_VLANID`
    ]
  },
  gx: {
    pppoeUsernamePath: [
      `${IGD_PPP}.Username`,
      `${DEVICE_PPP}.Username`
    ],
    pppoePasswordPath: [
      `${IGD_PPP}.Password`,
      `${DEVICE_PPP}.Password`
    ],
    vlanPath: [
      `${IGD_PPP}.X_GX_VLANID`,
      `${IGD_PPP}.X_CT-COM_VLANID`
    ]
  },
  zyxel: {
    pppoeUsernamePath: [
      `${DEVICE_PPP}.Username`,
      `${IGD_PPP}.Username`
    ],
    pppoePasswordPath: [
      `${DEVICE_PPP}.Password`,
      `${IGD_PPP}.Password`
    ],
    vlanPath: [
      `${DEVICE_IP}.X_ZYXEL_VlanId`,
      `${IGD_PPP}.X_CT-COM_VLANID`
    ]
  }
};

export function normalizeCustomerId(value) {
  return String(value || "").trim();
}

export function getPlanProvisioningIssues(plan = {}) {
  const provisioning = plan?.provisioning || {};
  const issues = [];
  if (!String(provisioning.accessProfileCode || "").trim()) issues.push("accessProfileCode");
  if (!(Number(provisioning.vlanId || 0) > 0)) issues.push("vlanId");
  if (!String(provisioning.pppoePrefix || "").trim()) issues.push("pppoePrefix");
  if (!String(provisioning.defaultPppoePassword || "").trim()) issues.push("defaultPppoePassword");
  if (!String(provisioning.wifiNamePrefix || "").trim()) issues.push("wifiNamePrefix");
  return issues;
}

export function isPlanProvisioningReady(plan = {}) {
  return getPlanProvisioningIssues(plan).length === 0;
}

export function buildPppoeCredentials(customerId, planProvisioning = {}) {
  const normalized = normalizeCustomerId(customerId);
  const digitsOnly = normalized.replace(/\D/g, "");
  const suffix = (digitsOnly || "00000000").slice(-8).padStart(8, "0");
  const prefix = String(planProvisioning?.pppoePrefix || "jf").trim() || "jf";
  const realm = String(planProvisioning?.pppoeRealm || "").trim();
  const usernameBase = `${prefix}-${suffix}`;
  return {
    username: realm ? `${usernameBase}@${realm}` : usernameBase,
    password: String(planProvisioning?.defaultPppoePassword || "123456")
  };
}

export function buildWifiCredentials(planProvisioning = {}) {
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += Math.floor(Math.random() * 10);
  }
  const prefix = String(planProvisioning?.wifiNamePrefix || "JustFiber").trim() || "JustFiber";
  return {
    ssid24: `${prefix}-2.4G`,
    ssid5: `${prefix}-5G`,
    password: `Just@${suffix}`
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

function mergePathLists(baseValue, overrideValue) {
  const list = [];
  for (const source of [overrideValue, baseValue]) {
    const values = Array.isArray(source) ? source : source ? [source] : [];
    for (const item of values) {
      if (item && !list.includes(item)) {
        list.push(item);
      }
    }
  }
  return list;
}

export function resolveProvisioningProfile(brand) {
  const override = BRAND_OVERRIDES[brand] || {};
  const merged = {};
  for (const key of Object.keys(GENERIC_PROFILE)) {
    merged[key] = mergePathLists(GENERIC_PROFILE[key], override[key]);
  }
  return merged;
}
