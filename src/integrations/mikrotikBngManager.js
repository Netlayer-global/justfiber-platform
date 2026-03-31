import { execFile } from "node:child_process";
import axios from "axios";
import https from "node:https";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { BngNode } from "../models/BngNode.js";
import { SubscriberService } from "../models/SubscriberService.js";

const execFileAsync = promisify(execFile);
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

function parseRadclientResult({ target, stdout = "", stderr = "", exitCode = 0 } = {}) {
  const normalizedStdout = String(stdout || "").trim();
  const normalizedStderr = String(stderr || "").trim();
  const combined = `${normalizedStdout}\n${normalizedStderr}`;
  const acknowledged =
    /Disconnect-ACK/i.test(combined) ||
    /CoA-ACK/i.test(combined) ||
    /Received\s+Disconnect-ACK/i.test(combined);

  return {
    target,
    stdout: normalizedStdout,
    stderr: normalizedStderr,
    exitCode,
    acknowledged
  };
}

function resolveCoaConfig(bngNode) {
  const host = String(bngNode?.coaHost || bngNode?.managementIp || bngNode?.radiusClientIp || "").trim();
  const secret = String(bngNode?.coaSecret || env.MIKROTIK_BNG_COA_SECRET || "").trim();
  const port = Number(bngNode?.coaPort || env.MIKROTIK_BNG_COA_PORT || 3799);
  return { host, secret, port };
}

function normalizeRouterApiBaseUrl(bngNode) {
  const explicit = String(bngNode?.apiBaseUrl || "").trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  const host = String(bngNode?.managementIp || "").trim();
  if (!host) return "";
  const port = Number(bngNode?.wwwPort || 80);
  const isHttps = port === 443 || port === 8443;
  return `${isHttps ? "https" : "http"}://${host}:${port}`;
}

function buildPoolRanges(pool) {
  const start = ipv4ToLong(pool?.ipFrom);
  const end = ipv4ToLong(pool?.ipTo);
  if (start === null || end === null || start > end) {
    throw new Error("Invalid pool IP range");
  }
  const excluded = Array.from(
    new Set(
      (Array.isArray(pool?.excludedIps) ? pool.excludedIps : [])
        .map((ip) => ipv4ToLong(ip))
        .filter((value) => value !== null && value >= start && value <= end)
        .sort((left, right) => left - right)
    )
  );
  const ranges = [];
  let segmentStart = start;
  for (const value of excluded) {
    if (value > segmentStart) {
      ranges.push([segmentStart, value - 1]);
    }
    segmentStart = value + 1;
  }
  if (segmentStart <= end) {
    ranges.push([segmentStart, end]);
  }
  return ranges
    .map(([from, to]) => {
      const fromIp = longToIpv4(from);
      const toIp = longToIpv4(to);
      return from === to ? fromIp : `${fromIp}-${toIp}`;
    })
    .filter(Boolean)
    .join(",");
}

function parseIpv4(ip) {
  const value = String(ip || "").trim();
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return octets;
}

function ipv4ToLong(ip) {
  const parts = parseIpv4(ip);
  if (!parts) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function longToIpv4(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0 || normalized > 0xffffffff) return null;
  return [
    (normalized >>> 24) & 255,
    (normalized >>> 16) & 255,
    (normalized >>> 8) & 255,
    normalized & 255
  ].join(".");
}

function buildPoolComment(pool) {
  const tags = [
    pool?.type ? `type:${pool.type}` : "",
    pool?.zone ? `zone:${pool.zone}` : "",
    pool?.useForRadius ? "radius:yes" : "radius:no",
    String(pool?.comments || "").trim()
  ].filter(Boolean);
  return tags.join(" | ").slice(0, 512);
}

async function mikrotikRestRequest(bngNode, method, path, data) {
  const baseUrl = normalizeRouterApiBaseUrl(bngNode);
  const username = String(bngNode?.routerOsUsername || "").trim();
  const password = String(bngNode?.routerOsPassword || "").trim();
  if (!baseUrl || !username || !password) {
    throw new Error("Router API not configured");
  }
  const url = `${baseUrl}/rest${path.startsWith("/") ? path : `/${path}`}`;
  const response = await axios.request({
    method,
    url,
    data,
    auth: { username, password },
    timeout: 15000,
    httpsAgent: insecureHttpsAgent,
    validateStatus: () => true
  });
  if (response.status >= 400) {
    throw new Error(
      typeof response.data === "string"
        ? response.data
        : response.data?.detail || response.data?.message || `Router API request failed with ${response.status}`
    );
  }
  return response.data;
}

async function findRouterPoolByName(bngNode, poolName) {
  const list = await mikrotikRestRequest(
    bngNode,
    "GET",
    `/ip/pool?.proplist=.id,name,ranges,comment&name=${encodeURIComponent(poolName)}`
  );
  return Array.isArray(list) ? list.find((item) => String(item?.name || "").trim() === poolName) || null : null;
}

function buildDisconnectPayload({ radiusUsername, service, bngNode, mode = "full" }) {
  const lines = [`User-Name = "${radiusUsername}"`];
  if (mode === "minimal") {
    return `${lines.join("\n")}\n`;
  }
  if (service?.currentIpv4) {
    lines.push(`Framed-IP-Address = ${service.currentIpv4}`);
  }
  const nasIdentifier = String(bngNode?.nasIdentifier || "").trim();
  if (nasIdentifier) {
    lines.push(`NAS-Identifier = "${nasIdentifier}"`);
  }
  const radiusClientIp = String(bngNode?.radiusClientIp || "").trim();
  if (radiusClientIp) {
    lines.push(`NAS-IP-Address = ${radiusClientIp}`);
  }
  return `${lines.join("\n")}\n`;
}

async function runDisconnect({ host, port, secret, payload }) {
  const target = `${host}:${port}`;
  try {
    const result = await execFileAsync(
      env.RADCLIENT_BIN,
      ["-x", target, "disconnect", secret],
      {
        input: payload,
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1024 * 1024
      }
    );
    return parseRadclientResult({
      target,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0
    });
  } catch (error) {
    const parsed = parseRadclientResult({
      target,
      stdout: error?.stdout,
      stderr: error?.stderr,
      exitCode: Number(error?.code ?? 1)
    });
    if (parsed.acknowledged) {
      return parsed;
    }
    throw Object.assign(error instanceof Error ? error : new Error("COA disconnect failed"), {
      target,
      stdout: parsed.stdout,
      stderr: parsed.stderr,
      exitCode: parsed.exitCode
    });
  };
}

export class MikrotikBngManager {
  async disconnectSubscriberSession({ serviceId, radiusUsername, reason = "refresh", sessionHint = null } = {}) {
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }))) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername })));
    if (!service) {
      return { attempted: false, status: "skipped", reason: "service_not_found" };
    }
    const username = radiusUsername || service.radiusUsername;
    if (!username) {
      return { attempted: false, status: "skipped", reason: "missing_radius_username" };
    }
    if (!service.bngNodeCode) {
      return { attempted: false, status: "skipped", reason: "missing_bng_node" };
    }

    const bngNode = await BngNode.findOne({ nodeCode: service.bngNodeCode }).lean();
    if (!bngNode) {
      return { attempted: false, status: "skipped", reason: "bng_node_not_found" };
    }
    if (bngNode.vendor !== "mikrotik") {
      return { attempted: false, status: "skipped", reason: "unsupported_vendor", vendor: bngNode.vendor };
    }

    const { host, port, secret } = resolveCoaConfig(bngNode);
    if (!host || !secret) {
      return {
        attempted: false,
        status: "skipped",
        reason: !host ? "missing_coa_host" : "missing_coa_secret",
        bngNodeCode: bngNode.nodeCode,
        sessionHint
      };
    }

    const payload = buildDisconnectPayload({ radiusUsername: username, service, bngNode, mode: "full" });
    try {
      const result = await runDisconnect({ host, port, secret, payload });
      return {
        attempted: true,
        status: "sent",
        action: reason,
        bngNodeCode: bngNode.nodeCode,
        target: result.target,
        payloadMode: "full",
        exitCode: result.exitCode,
        acknowledged: Boolean(result.acknowledged),
        stdout: result.stdout,
        stderr: result.stderr,
        sessionHint
      };
    } catch (error) {
      const minimalPayload = buildDisconnectPayload({
        radiusUsername: username,
        service,
        bngNode,
        mode: "minimal"
      });
      try {
        const fallback = await runDisconnect({ host, port, secret, payload: minimalPayload });
        return {
          attempted: true,
          status: "sent",
          action: reason,
          bngNodeCode: bngNode.nodeCode,
          target: fallback.target,
          payloadMode: "minimal_fallback",
          exitCode: fallback.exitCode,
          acknowledged: Boolean(fallback.acknowledged),
          stdout: fallback.stdout,
          stderr: fallback.stderr,
          initialFailure: error instanceof Error ? error.message : "Initial COA disconnect failed",
          sessionHint
        };
      } catch (fallbackError) {
      return {
        attempted: true,
        status: "failed",
        action: reason,
        bngNodeCode: bngNode.nodeCode,
        target: `${host}:${port}`,
        payloadMode: "full_then_minimal",
        exitCode: Number(fallbackError?.exitCode ?? error?.exitCode ?? 1),
        stdout: String(fallbackError?.stdout || error?.stdout || "").trim(),
        stderr: String(fallbackError?.stderr || error?.stderr || "").trim(),
        error: fallbackError instanceof Error ? fallbackError.message : "COA disconnect failed",
        initialFailure: error instanceof Error ? error.message : "Initial COA disconnect failed",
        sessionHint
      };
      }
    }
  }

  async syncIpPoolRange({ pool, routerNodeCodes = [] } = {}) {
    const normalizedRouterCodes = Array.from(
      new Set((Array.isArray(routerNodeCodes) ? routerNodeCodes : []).map((item) => String(item || "").trim()).filter(Boolean))
    );
    const routers = normalizedRouterCodes.length
      ? await BngNode.find({ nodeCode: { $in: normalizedRouterCodes } }).lean()
      : await BngNode.find({ status: "active", vendor: "mikrotik" }).lean();
    const ranges = buildPoolRanges(pool);
    if (!ranges) {
      throw new Error("No usable IPs remain after exclusions");
    }
    const comment = buildPoolComment(pool);
    const results = [];

    for (const router of routers) {
      try {
        const existingPool = await findRouterPoolByName(router, String(pool?.name || "").trim());
        if (existingPool?.[".id"]) {
          await mikrotikRestRequest(router, "PATCH", `/ip/pool/${encodeURIComponent(existingPool[".id"])}`, {
            name: pool.name,
            ranges,
            comment
          });
          results.push({
            routerNodeCode: router.nodeCode,
            routerDisplayName: router.displayName || router.nodeCode,
            status: "synced",
            action: "updated",
            target: normalizeRouterApiBaseUrl(router),
            detail: ranges,
            syncedAt: new Date()
          });
        } else {
          await mikrotikRestRequest(router, "PUT", "/ip/pool", {
            name: pool.name,
            ranges,
            comment
          });
          results.push({
            routerNodeCode: router.nodeCode,
            routerDisplayName: router.displayName || router.nodeCode,
            status: "synced",
            action: "created",
            target: normalizeRouterApiBaseUrl(router),
            detail: ranges,
            syncedAt: new Date()
          });
        }
      } catch (error) {
        results.push({
          routerNodeCode: router.nodeCode,
          routerDisplayName: router.displayName || router.nodeCode,
          status: "failed",
          action: "sync",
          target: normalizeRouterApiBaseUrl(router),
          detail: error instanceof Error ? error.message : "Router sync failed",
          syncedAt: new Date()
        });
      }
    }

    if (!results.length) {
      results.push({
        routerNodeCode: "",
        routerDisplayName: "",
        status: "skipped",
        action: "sync",
        target: "",
        detail: "No eligible MikroTik routers found",
        syncedAt: new Date()
      });
    }

    return results;
  }

  async deleteIpPoolRange({ poolName, routerNodeCodes = [] } = {}) {
    const normalizedPoolName = String(poolName || "").trim();
    const normalizedRouterCodes = Array.from(
      new Set((Array.isArray(routerNodeCodes) ? routerNodeCodes : []).map((item) => String(item || "").trim()).filter(Boolean))
    );
    const routers = normalizedRouterCodes.length
      ? await BngNode.find({ nodeCode: { $in: normalizedRouterCodes } }).lean()
      : await BngNode.find({ status: "active", vendor: "mikrotik" }).lean();
    const results = [];

    for (const router of routers) {
      try {
        const existingPool = await findRouterPoolByName(router, normalizedPoolName);
        if (!existingPool?.[".id"]) {
          results.push({
            routerNodeCode: router.nodeCode,
            routerDisplayName: router.displayName || router.nodeCode,
            status: "skipped",
            action: "delete",
            target: normalizeRouterApiBaseUrl(router),
            detail: "Pool not present on router",
            syncedAt: new Date()
          });
          continue;
        }
        await mikrotikRestRequest(router, "DELETE", `/ip/pool/${encodeURIComponent(existingPool[".id"])}`);
        results.push({
          routerNodeCode: router.nodeCode,
          routerDisplayName: router.displayName || router.nodeCode,
          status: "synced",
          action: "deleted",
          target: normalizeRouterApiBaseUrl(router),
          detail: normalizedPoolName,
          syncedAt: new Date()
        });
      } catch (error) {
        results.push({
          routerNodeCode: router.nodeCode,
          routerDisplayName: router.displayName || router.nodeCode,
          status: "failed",
          action: "delete",
          target: normalizeRouterApiBaseUrl(router),
          detail: error instanceof Error ? error.message : "Router delete failed",
          syncedAt: new Date()
        });
      }
    }

    if (!results.length) {
      results.push({
        routerNodeCode: "",
        routerDisplayName: "",
        status: "skipped",
        action: "delete",
        target: "",
        detail: "No eligible MikroTik routers found",
        syncedAt: new Date()
      });
    }
    return results;
  }
}

export const mikrotikBngManager = new MikrotikBngManager();
