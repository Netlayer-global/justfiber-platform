import { z } from "zod";

export const updateConfigSchema = z.object({
  value: z.any(),
  valueType: z.enum(["string", "number", "boolean", "json"]),
  category: z.string().min(2)
});
