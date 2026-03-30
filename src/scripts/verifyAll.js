import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { runSmokeAllModules } from "./smokeAllModules.js";

const PROJECT_ROOT = process.cwd();
const NODE_BIN = process.execPath;
const STARTUP_TIMEOUT_MS = Number(process.env.VERIFY_STARTUP_TIMEOUT_MS || 90000);
const POLL_INTERVAL_MS = 1500;
const VERIFY_PORT = Number(process.env.VERIFY_PORT || 4100);
const BASE_URL = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${VERIFY_PORT}`;
const VERIFY_ENV = {
  ...process.env,
  PORT: String(VERIFY_PORT),
  SMOKE_BASE_URL: BASE_URL,
  EXPOSE_DEMO_OTP: process.env.EXPOSE_DEMO_OTP || "true"
};

// Ensure in-process smoke runner also targets isolated verify server.
process.env.PORT = String(VERIFY_PORT);
process.env.SMOKE_BASE_URL = BASE_URL;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnNode(scriptPath, label, extraEnv = {}) {
  const child = spawn(NODE_BIN, [scriptPath], {
    cwd: PROJECT_ROOT,
    env: { ...VERIFY_ENV, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  return child;
}

async function runNodeScript(scriptPath, label, envOverride = {}) {
  await new Promise((resolve, reject) => {
    const child = spawnNode(scriptPath, label, envOverride);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

async function waitForApiReady(apiProcess) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`API process exited early with code ${apiProcess.exitCode}`);
    }
    try {
      const response = await fetch(`${BASE_URL}/health/ready`);
      if (response.ok) {
        const payload = await response.json();
        if (payload?.success === true) {
          return;
        }
      }
    } catch {
      // Ignore and retry until timeout.
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`API did not become ready within ${STARTUP_TIMEOUT_MS}ms`);
}

async function stopChild(child, label) {
  if (!child || child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.on("exit", resolve)),
    sleep(5000)
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
  console.log(`${label} stopped`);
}

async function main() {
  console.log("Seeding admin and sample data...");
  await runNodeScript("src/scripts/seedAdmin.js", "seed-admin", VERIFY_ENV);
  await runNodeScript("src/scripts/seedSampleData.js", "seed-sample", VERIFY_ENV);

  console.log("Starting API and worker...");
  const api = spawnNode("src/index.js", "api", VERIFY_ENV);
  const worker = spawnNode("src/worker.js", "worker", VERIFY_ENV);

  try {
    await waitForApiReady(api);
    console.log("API is ready. Running smoke checks...");
    await runSmokeAllModules();
    console.log("Smoke checks passed. Running billing automation checks...");
    await runNodeScript("src/scripts/testBillingAutomation.js", "billing-verify", VERIFY_ENV);
    console.log("verify:all completed successfully");
  } finally {
    await stopChild(api, "API");
    await stopChild(worker, "Worker");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
