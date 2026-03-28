import { z } from "zod";

export const leaveStartSchema = z.object({
  reason: z.string().min(3).max(300),
  expectedEndAt: z.string().datetime().optional()
});

export const serialSchema = z.object({
  serialNumber: z.string().min(4).max(64),
  deviceId: z.string().min(3).max(255).optional()
});

export const opticalSchema = z.object({
  rxPower: z.coerce.number(),
  txPower: z.coerce.number()
});

export const retrySchema = z.object({
  note: z.string().min(3).max(300).optional()
});

export const deferJobSchema = z.object({
  reason: z.enum(["customer_unavailable", "revisit_required", "material_pending", "escalated", "other"]),
  note: z.string().min(3).max(500)
});

export const cancelInstallationSchema = z.object({
  reason: z.enum(["customer_cancelled", "technical_feasibility_failed", "payment_issue", "material_unavailable", "duplicate_booking", "other"]),
  note: z.string().min(3).max(500)
});

export const proofSchema = z.object({
  routerPhotoUrl: z.string().url(),
  cablePhotoUrl: z.string().url(),
  extraPhotos: z.array(z.string().url()).optional()
});

export const otpVerifySchema = z.object({
  otp: z.string().length(6)
});

export const complaintStartSchema = z.object({
  resolutionCode: z.string().min(2).max(50).optional(),
  note: z.string().min(3).max(500).optional()
});

export const replaceDeviceSchema = z.object({
  newSerialNumber: z.string().min(4).max(64),
  reason: z.string().min(3).max(300)
});

export const locationCheckinSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: z.string().min(3).max(500).optional()
});

export const installationChecklistSchema = z.object({
  fiberLinked: z.coerce.boolean(),
  powerLevelOk: z.coerce.boolean(),
  wanConfigured: z.coerce.boolean(),
  wifiConfigured: z.coerce.boolean(),
  speedTestDone: z.coerce.boolean(),
  customerEducated: z.coerce.boolean(),
  notes: z.string().min(3).max(500).optional()
});
