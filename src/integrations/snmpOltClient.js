/**
 * SNMP OLT Client — Polls OLT devices for ONT status and optical power.
 * 
 * Supports: Huawei, ZTE, VSOL, Nokia, FiberHome, BDCOM
 * Uses net-snmp library for SNMP v2c/v3 communication.
 * 
 * Common OIDs by vendor:
 * - Huawei MA56xx: 
 *   ONT status: 1.3.6.1.4.1.2011.6.128.1.1.2.46.1.15 (hwGponDeviceOntControlRunStatus)
 *   Rx Power:   1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4  (hwGponOntOpticalDdmRxPower)
 *   Tx Power:   1.3.6.1.4.1.2011.6.128.1.1.2.51.1.5  (hwGponOntOpticalDdmTxPower)
 * 
 * - ZTE C3xx:
 *   ONT status: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2 (zxAnGponOntRunningStatus)
 *   Rx Power:   1.3.6.1.4.1.3902.1082.500.10.2.3.5.1.2 (zxAnGponOntOptRxPower)
 * 
 * - VSOL:
 *   ONT status: 1.3.6.1.4.1.37950.1.1.5.12.1.1.1.2
 *   Rx Power:   1.3.6.1.4.1.37950.1.1.5.12.1.1.1.8
 * 
 * - BDCOM:
 *   ONT status: 1.3.6.1.4.1.3320.101.10.1.1.26
 *   Rx Power:   1.3.6.1.4.1.3320.101.10.5.1.5
 */

import { env } from "../config/env.js";

// OID tables per vendor
const VENDOR_OIDS = {
  huawei: {
    ontStatus: "1.3.6.1.4.1.2011.6.128.1.1.2.46.1.15",
    ontRxPower: "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4",
    ontTxPower: "1.3.6.1.4.1.2011.6.128.1.1.2.51.1.5",
    ontSerialNumber: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.3",
    ontDescription: "1.3.6.1.4.1.2011.6.128.1.1.2.43.1.9",
    ontDistance: "1.3.6.1.4.1.2011.6.128.1.1.2.46.1.20",
    // Status values: 1=online, 2=offline, 3=dying_gasp
    statusMap: { 1: "online", 2: "offline", 3: "dying_gasp" },
    // Rx power is in 0.01 dBm units
    rxPowerDivisor: 100,
  },
  zte: {
    ontStatus: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2",
    ontRxPower: "1.3.6.1.4.1.3902.1082.500.10.2.3.5.1.2",
    ontTxPower: "1.3.6.1.4.1.3902.1082.500.10.2.3.5.1.1",
    ontSerialNumber: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3",
    ontDescription: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.5",
    ontDistance: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.12",
    statusMap: { 1: "online", 2: "offline", 3: "dying_gasp" },
    rxPowerDivisor: 100,
  },
  vsol: {
    ontStatus: "1.3.6.1.4.1.37950.1.1.5.12.1.1.1.2",
    ontRxPower: "1.3.6.1.4.1.37950.1.1.5.12.1.1.1.8",
    ontTxPower: "1.3.6.1.4.1.37950.1.1.5.12.1.1.1.7",
    ontSerialNumber: "1.3.6.1.4.1.37950.1.1.5.12.1.1.1.3",
    ontDescription: "",
    ontDistance: "1.3.6.1.4.1.37950.1.1.5.12.1.1.1.10",
    statusMap: { 1: "online", 2: "offline" },
    rxPowerDivisor: 100,
  },
  bdcom: {
    ontStatus: "1.3.6.1.4.1.3320.101.10.1.1.26",
    ontRxPower: "1.3.6.1.4.1.3320.101.10.5.1.5",
    ontTxPower: "1.3.6.1.4.1.3320.101.10.5.1.4",
    ontSerialNumber: "1.3.6.1.4.1.3320.101.10.1.1.3",
    ontDescription: "",
    ontDistance: "1.3.6.1.4.1.3320.101.10.1.1.28",
    statusMap: { 1: "online", 2: "offline", 3: "dying_gasp" },
    rxPowerDivisor: 100,
  },
  nokia: {
    ontStatus: "1.3.6.1.4.1.637.61.1.35.10.14.1.2",
    ontRxPower: "1.3.6.1.4.1.637.61.1.35.10.18.1.2",
    ontTxPower: "1.3.6.1.4.1.637.61.1.35.10.18.1.3",
    ontSerialNumber: "1.3.6.1.4.1.637.61.1.35.10.14.1.3",
    ontDescription: "",
    ontDistance: "1.3.6.1.4.1.637.61.1.35.10.14.1.8",
    statusMap: { 1: "online", 2: "offline" },
    rxPowerDivisor: 1000,
  },
  fiberhome: {
    ontStatus: "1.3.6.1.4.1.5765.1.1.1.1.1.1.1.2",
    ontRxPower: "1.3.6.1.4.1.5765.1.1.1.1.1.1.1.8",
    ontTxPower: "1.3.6.1.4.1.5765.1.1.1.1.1.1.1.7",
    ontSerialNumber: "1.3.6.1.4.1.5765.1.1.1.1.1.1.1.3",
    ontDescription: "",
    ontDistance: "",
    statusMap: { 1: "online", 2: "offline" },
    rxPowerDivisor: 100,
  },
  other: {
    ontStatus: "",
    ontRxPower: "",
    ontTxPower: "",
    ontSerialNumber: "",
    ontDescription: "",
    ontDistance: "",
    statusMap: { 1: "online", 2: "offline" },
    rxPowerDivisor: 100,
  },
};

/**
 * Poll a single OLT via SNMP and return ONT status data.
 * Returns array of ONT entries with status and optical power.
 */
export async function pollOltViaSNMP(oltDevice) {
  const vendor = oltDevice.vendor || "other";
  const oids = VENDOR_OIDS[vendor] || VENDOR_OIDS.other;

  if (!oids.ontStatus) {
    return { success: false, error: `No SNMP OIDs configured for vendor: ${vendor}`, onts: [] };
  }

  let snmp;
  try {
    snmp = await import("net-snmp");
  } catch (e) {
    return { success: false, error: "net-snmp package not installed. Run: npm install net-snmp", onts: [] };
  }

  const options = {
    port: oltDevice.snmpPort || 161,
    version: oltDevice.snmpVersion === "3" ? snmp.default.Version3 : snmp.default.Version2c,
    timeout: 15000,
    retries: 2,
  };

  let session;
  try {
    if (oltDevice.snmpVersion === "3" && oltDevice.snmpV3User) {
      const user = {
        name: oltDevice.snmpV3User,
        level: snmp.default.SecurityLevel.authPriv,
        authProtocol: oltDevice.snmpV3AuthProtocol === "sha" ? snmp.default.AuthProtocols.sha : snmp.default.AuthProtocols.md5,
        authKey: oltDevice.snmpV3AuthKey || "",
        privProtocol: oltDevice.snmpV3PrivProtocol === "aes" ? snmp.default.PrivProtocols.aes : snmp.default.PrivProtocols.des,
        privKey: oltDevice.snmpV3PrivKey || "",
      };
      session = snmp.default.createV3Session(oltDevice.ipAddress, user, options);
    } else {
      session = snmp.default.createSession(oltDevice.ipAddress, oltDevice.snmpCommunity || "public", options);
    }
  } catch (e) {
    return { success: false, error: `Failed to create SNMP session: ${e.message}`, onts: [] };
  }

  const onts = [];

  try {
    // Walk ONT status OID
    const statusResults = await snmpWalk(session, oids.ontStatus);
    
    // Walk Rx Power OID
    const rxResults = oids.ontRxPower ? await snmpWalk(session, oids.ontRxPower).catch(() => []) : [];
    
    // Walk Tx Power OID
    const txResults = oids.ontTxPower ? await snmpWalk(session, oids.ontTxPower).catch(() => []) : [];

    // Walk Serial Number OID
    const snResults = oids.ontSerialNumber ? await snmpWalk(session, oids.ontSerialNumber).catch(() => []) : [];

    // Walk Distance OID
    const distResults = oids.ontDistance ? await snmpWalk(session, oids.ontDistance).catch(() => []) : [];

    // Build rx power map by OID suffix
    const rxMap = new Map();
    for (const item of rxResults) {
      const suffix = item.oid.replace(oids.ontRxPower + ".", "");
      rxMap.set(suffix, Number(item.value) / (oids.rxPowerDivisor || 100));
    }

    // Build tx power map
    const txMap = new Map();
    for (const item of txResults) {
      const suffix = item.oid.replace(oids.ontTxPower + ".", "");
      txMap.set(suffix, Number(item.value) / (oids.rxPowerDivisor || 100));
    }

    // Build serial number map
    const snMap = new Map();
    for (const item of snResults) {
      const suffix = item.oid.replace(oids.ontSerialNumber + ".", "");
      snMap.set(suffix, String(item.value || "").trim());
    }

    // Build distance map
    const distMap = new Map();
    for (const item of distResults) {
      const suffix = item.oid.replace(oids.ontDistance + ".", "");
      distMap.set(suffix, Number(item.value) || 0);
    }

    // Parse status results
    for (const item of statusResults) {
      const suffix = item.oid.replace(oids.ontStatus + ".", "");
      const parts = suffix.split(".");
      // Typically: ponPort.ontIndex or frame.slot.port.ontIndex
      let ponPort = 0;
      let ontIndex = 0;
      
      if (parts.length >= 2) {
        ponPort = Number(parts[parts.length - 2]) || 0;
        ontIndex = Number(parts[parts.length - 1]) || 0;
      } else if (parts.length === 1) {
        ontIndex = Number(parts[0]) || 0;
      }

      const statusValue = Number(item.value);
      const onlineStatus = oids.statusMap[statusValue] || "unknown";
      const rxPower = rxMap.get(suffix);
      const txPower = txMap.get(suffix);
      const serialNumber = snMap.get(suffix) || "";
      const distance = distMap.get(suffix) || 0;

      // Determine Rx power status
      let rxPowerStatus = "unknown";
      if (rxPower !== undefined && !isNaN(rxPower)) {
        const rxWarn = oltDevice.rxWarningThreshold || -25;
        const rxCrit = oltDevice.rxCriticalThreshold || -28;
        if (rxPower >= rxWarn) rxPowerStatus = "normal";
        else if (rxPower >= rxCrit) rxPowerStatus = "warning";
        else rxPowerStatus = "critical";
      }

      onts.push({
        ponPort,
        ontIndex,
        serialNumber,
        onlineStatus,
        rxPower: rxPower !== undefined ? Number(rxPower.toFixed(2)) : null,
        txPower: txPower !== undefined ? Number(txPower.toFixed(2)) : null,
        rxPowerStatus,
        distance,
        oidSuffix: suffix,
      });
    }
  } catch (e) {
    session.close();
    return { success: false, error: `SNMP poll failed: ${e.message}`, onts: [] };
  }

  session.close();
  return { success: true, onts, polledAt: new Date() };
}

/**
 * SNMP Walk helper — returns array of { oid, value }
 */
function snmpWalk(session, baseOid) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    function feedCb(varbinds) {
      for (const vb of varbinds) {
        if (snmpModule.default.isVarbindError(vb)) continue;
        results.push({ oid: vb.oid, value: vb.value });
      }
    }

    function doneCb(error) {
      if (error) reject(error);
      else resolve(results);
    }

    session.subtree(baseOid, 20, feedCb, doneCb);
  });
}

let snmpModule = null;

/**
 * Get vendor OIDs for reference
 */
export function getVendorOids(vendor) {
  return VENDOR_OIDS[vendor] || VENDOR_OIDS.other;
}

/**
 * Test SNMP connectivity to an OLT
 */
export async function testOltConnection(oltDevice) {
  try {
    const snmp = await import("net-snmp");
    snmpModule = snmp;
    
    const session = snmp.default.createSession(
      oltDevice.ipAddress,
      oltDevice.snmpCommunity || "public",
      { port: oltDevice.snmpPort || 161, timeout: 10000, retries: 1 }
    );

    return new Promise((resolve) => {
      // Try to get sysDescr (1.3.6.1.2.1.1.1.0) — universal OID
      session.get(["1.3.6.1.2.1.1.1.0"], (error, varbinds) => {
        session.close();
        if (error) {
          resolve({ success: false, error: error.message });
        } else if (varbinds && varbinds.length > 0) {
          resolve({ success: true, sysDescr: String(varbinds[0].value || "") });
        } else {
          resolve({ success: false, error: "No response from OLT" });
        }
      });
    });
  } catch (e) {
    return { success: false, error: `SNMP test failed: ${e.message}` };
  }
}
