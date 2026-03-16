import { z } from "zod";

export const statusActionSchema = z.object({
  reason: z.string().min(3).max(300)
});

export const retryProvisioningSchema = z.object({
  presetName: z.enum(["SERVICE_PREPARE", "SERVICE_ACTIVATE", "SERVICE_SUSPEND", "SERVICE_RESUME"])
});
