import { z } from "zod";

export const leaveStartSchema = z.object({
  reason: z.string().min(3).max(300),
  expectedEndAt: z.string().datetime().optional()
});

export const serialSchema = z.object({
  serialNumber: z.string().min(4).max(64)
});

export const opticalSchema = z.object({
  rxPower: z.coerce.number(),
  txPower: z.coerce.number()
});

export const retrySchema = z.object({
  note: z.string().min(3).max(300).optional()
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
