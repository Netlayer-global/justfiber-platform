import { env } from "../config/env.js";
import { allowedPresets, genieacsClient } from "../integrations/genieacsClient.js";

const DEVICE_ID = process.env.TEST_GENIE_DEVICE_ID || "ONT-1001";
const ENABLE_WRITES = process.env.TEST_GENIE_ENABLE_WRITES === "true";
const PRESET_NAME = process.env.TEST_GENIE_PRESET || "SERVICE_RETRY";

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function skip(message) {
  console.log(`[SKIP] ${message}`);
}

async function runStep(results, label, fn) {
  try {
    const data = await fn();
    pass(label);
    results.push({ label, ok: true, keys: Object.keys(data || {}).slice(0, 8) });
  } catch (error) {
    fail(`${label}: ${error.message}`);
    results.push({ label, ok: false, error: error.message });
  }
}

async function main() {
  if (env.MOCK_EXTERNALS) {
    throw new Error("MOCK_EXTERNALS=true. Set MOCK_EXTERNALS=false in .env before live GenieACS tests.");
  }

  const results = [];

  await runStep(results, `GenieACS getDeviceSummary (${DEVICE_ID})`, async () => {
    return genieacsClient.getDeviceSummary(DEVICE_ID);
  });

  await runStep(results, "GenieACS allowed presets list", async () => {
    return { presets: [...allowedPresets] };
  });

  if (!ENABLE_WRITES) {
    skip("Write tests disabled. Set TEST_GENIE_ENABLE_WRITES=true to test applyPreset.");
  } else {
    if (!allowedPresets.has(PRESET_NAME)) {
      throw new Error(`Preset ${PRESET_NAME} is not in allowedPresets.`);
    }
    await runStep(results, `GenieACS applyPreset (${DEVICE_ID}, ${PRESET_NAME})`, async () => {
      return genieacsClient.applyPreset({
        deviceId: DEVICE_ID,
        presetName: PRESET_NAME,
        correlationId: `genie-test-${Date.now()}`
      });
    });
  }

  const failed = results.filter((item) => !item.ok).length;
  console.log("\nGenieACS module test summary:");
  for (const item of results) {
    if (item.ok) {
      console.log(`- ${item.label}: OK (${item.keys.join(", ") || "no keys"})`);
    } else {
      console.log(`- ${item.label}: FAIL (${item.error})`);
    }
  }
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
