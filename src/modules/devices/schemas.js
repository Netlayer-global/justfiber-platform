import { z } from "zod";

export const applyPresetSchema = z.object({
  presetName: z.enum(["SERVICE_PREPARE", "SERVICE_ACTIVATE", "SERVICE_SUSPEND", "SERVICE_RESUME"])
});
