import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { BngNode } from "../models/BngNode.js";
import { SubscriberService } from "../models/SubscriberService.js";

const execFileAsync = promisify(execFile);

function resolveCoaConfig(bngNode) {
  const host = String(bngNode?.coaHost || bngNode?.managementIp || bngNode?.radiusClientIp || "").trim();
  const secret = String(bngNode?.coaSecret || env.MIKROTIK_BNG_COA_SECRET || "").trim();
  const port = Number(bngNode?.coaPort || env.MIKROTIK_BNG_COA_PORT || 3799);
  return { host, secret, port };
}

function buildDisconnectPayload({ radiusUsername, service, bngNode }) {
  const lines = [`User-Name = "${radiusUsername}"`];
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
  return {
    target,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim()
  };
}

export class MikrotikBngManager {
  async disconnectSubscriberSession({ serviceId, radiusUsername, reason = "refresh" } = {}) {
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
        bngNodeCode: bngNode.nodeCode
      };
    }

    const payload = buildDisconnectPayload({ radiusUsername: username, service, bngNode });
    try {
      const result = await runDisconnect({ host, port, secret, payload });
      return {
        attempted: true,
        status: "sent",
        action: reason,
        bngNodeCode: bngNode.nodeCode,
        target: result.target,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (error) {
      return {
        attempted: true,
        status: "failed",
        action: reason,
        bngNodeCode: bngNode.nodeCode,
        target: `${host}:${port}`,
        error: error instanceof Error ? error.message : "COA disconnect failed"
      };
    }
  }
}

export const mikrotikBngManager = new MikrotikBngManager();
