import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { BngNode } from "../models/BngNode.js";
import { SubscriberService } from "../models/SubscriberService.js";

const execFileAsync = promisify(execFile);

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
        stderr: result.stderr
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
          initialFailure: error instanceof Error ? error.message : "Initial COA disconnect failed"
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
        initialFailure: error instanceof Error ? error.message : "Initial COA disconnect failed"
      };
      }
    }
  }
}

export const mikrotikBngManager = new MikrotikBngManager();
