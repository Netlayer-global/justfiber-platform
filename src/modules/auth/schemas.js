import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().min(3),
  password: z.string().min(8)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10)
});
