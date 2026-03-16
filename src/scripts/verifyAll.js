import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { runSmokeAllModules } from "./smokeAllModules.js";

const PROJECT_ROOT = process.cwd();
const NODE_BIN = process.execPath;
const STARTUP_TIMEOUT_MS = Number(process.env.VERIFY_STARTUP_TIMEOUT_MS || 90000);
const POLL_INTERVAL_MS = 1500;
const BASE_URL = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnNode(scriptPath, label) {
  const child = spawn(NODE_BIN, [scriptPath], {
    cwd: PROJECT_ROOT,
    env: process.env,
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

async function runNodeScript(scriptPath, label) {
  await new Promise((resolve, reject) => {
    const child = spawnNode(scriptPath, label);
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

async function waitForApiReady() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
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
  await runNodeScript("src/scripts/seedAdmin.js", "seed-admin");
  await runNodeScript("src/scripts/seedSampleData.js", "seed-sample");

  console.log("Starting API and worker...");
  const api = spawnNode("src/index.js", "api");
  const worker = spawnNode("src/worker.js", "worker");

  try {
    await waitForApiReady();
    console.log("API is ready. Running smoke checks...");
    await runSmokeAllModules();
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
