import { z } from "zod";

export const installerLoginSchema = z.object({
  login: z.string().min(3),
  password: z.string().min(8),
  deviceId: z.string().optional(),
  appVersion: z.string().optional()
});

export const installerRefreshSchema = z.object({
  refreshToken: z.string().min(10)
});
