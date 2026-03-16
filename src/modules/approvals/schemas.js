import { z } from "zod";

export const decisionSchema = z.object({
  note: z.string().max(500).optional()
});
