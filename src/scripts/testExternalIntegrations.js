import { env } from "../config/env.js";
import { genieacsClient } from "../integrations/genieacsClient.js";

const genieDeviceId = process.env.TEST_GENIE_DEVICE_ID || "ONT-1001";

function printPass(message) {
  console.log(`[PASS] ${message}`);
}

function printFail(message) {
  console.error(`[FAIL] ${message}`);
}

async function main() {
  if (env.MOCK_EXTERNALS) {
    throw new Error("MOCK_EXTERNALS=true. Set MOCK_EXTERNALS=false in .env before live integration test.");
  }

  const results = [];

  try {
    const genieData = await genieacsClient.getDeviceSummary(genieDeviceId);
    printPass(`GenieACS device summary fetch succeeded for device ${genieDeviceId}`);
    results.push({ system: "genieacs", ok: true, sampleKeys: Object.keys(genieData || {}).slice(0, 8) });
  } catch (error) {
    printFail(`GenieACS device summary fetch failed: ${error.message}`);
    results.push({ system: "genieacs", ok: false, error: error.message });
  }

  console.log("\nIntegration test summary:");
  for (const item of results) {
    if (item.ok) {
      console.log(`- ${item.system}: OK (${item.sampleKeys.join(", ") || "no keys"})`);
    } else {
      console.log(`- ${item.system}: FAIL (${item.error})`);
    }
  }

  const failed = results.filter((item) => !item.ok).length;
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
