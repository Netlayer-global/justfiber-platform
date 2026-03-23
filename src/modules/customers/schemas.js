import { z } from "zod";

export const statusActionSchema = z.object({
  reason: z.string().min(3).max(300)
});

export const retryProvisioningSchema = z.object({
  presetName: z.enum(["SERVICE_PREPARE", "SERVICE_ACTIVATE", "SERVICE_SUSPEND", "SERVICE_RESUME"])
});

export const adminPlanChangeSchema = z.object({
  planCode: z.string().min(2),
  effectiveMode: z.enum(["immediate", "next_cycle"]).default("immediate"),
  forceApply: z.boolean().optional(),
  note: z.string().max(300).optional()
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["initiated", "payment_pending", "paid", "awaiting_assignment", "assigned", "in_progress", "installed", "cancelled"]),
  note: z.string().max(300).optional()
});

export const assignBookingInstallerSchema = z.object({
  installerId: z.string().min(2),
  note: z.string().max(300).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium")
});

export const updateCustomerSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().min(8).max(20).optional(),
  email: z.string().email().nullable().optional(),
  planCode: z.string().min(2).optional(),
  planName: z.string().min(2).optional(),
  operationalStatus: z.string().min(2).optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    area: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pinCode: z.string().optional(),
    gps: z.object({
      lat: z.number().optional(),
      lng: z.number().optional()
    }).optional()
  }).partial().optional(),
  billingSnapshot: z.record(z.any()).optional(),
  invoiceSummary: z.record(z.any()).optional()
});
