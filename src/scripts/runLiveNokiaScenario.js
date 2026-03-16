import { pathToFileURL } from "node:url";
import runLiveProvisionScenario from "./runLiveProvisionScenario.js";

if (!process.env.LIVE_ONT_LABEL) {
  process.env.LIVE_ONT_LABEL = "Nokia";
}

if (!process.env.LIVE_ONT_SERIAL && process.env.LIVE_NOKIA_SERIAL) {
  process.env.LIVE_ONT_SERIAL = process.env.LIVE_NOKIA_SERIAL;
}

if (!process.env.LIVE_ONT_DEVICE_ID && process.env.LIVE_NOKIA_DEVICE_ID) {
  process.env.LIVE_ONT_DEVICE_ID = process.env.LIVE_NOKIA_DEVICE_ID;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runLiveProvisionScenario();
}
