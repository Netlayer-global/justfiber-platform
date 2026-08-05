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
  billingTerm: z.enum(["monthly", "quarterly", "halfYearly", "yearly"]).default("monthly"),
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
  zoneCode: z.string().min(1).max(80).optional(),
  zoneName: z.string().min(1).max(200).optional(),
  zoneStateCode: z.string().max(20).optional(),
  zoneStateName: z.string().max(120).optional(),
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
  invoiceSummary: z.record(z.any()).optional(),
  radiusService: z.object({
    currentIpv4: z.string().max(64).nullable().optional(),
    ipv4Pool: z.string().max(128).nullable().optional(),
    bngNodeCode: z.string().max(64).nullable().optional(),
    autoSelectBng: z.boolean().optional()
  }).optional()
});

export const manualCreateCustomerSchema = z.object({
  customerId: z.string().min(3).max(40).optional(),
  accountNumber: z.string().min(3).max(40).optional(),
  serviceId: z.string().min(3).max(40).optional(),
  startDate: z.string().date().optional(),
  fullName: z.string().min(2).max(200),
  phone: z.string().min(8).max(20),
  email: z.string().email().nullable().optional(),
  planCode: z.string().min(2),
  billingTerm: z.enum(["monthly", "quarterly", "halfYearly", "yearly"]).default("monthly"),
  operationalStatus: z.enum(["active", "inactive", "suspended"]).default("active"),
  customerType: z.enum(["home", "business"]).default("home"),
  zoneCode: z.string().min(1).max(80).optional(),
  zoneName: z.string().min(1).max(200).optional(),
  zoneStateCode: z.string().max(20).optional(),
  zoneStateName: z.string().max(120).optional(),
  address: z.object({
    line1: z.string().min(2).max(200),
    line2: z.string().max(200).optional(),
    area: z.string().max(120).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    pinCode: z.string().max(20).optional()
  }),
  radiusUsername: z.string().min(3).max(64).optional(),
  radiusPassword: z.string().min(1).max(64).optional(),
  accessProfileCode: z.string().min(2).max(64).optional(),
  billingProfileCode: z.string().min(2).max(64).optional(),
  bngNodeCode: z.string().min(2).max(64).optional(),
  currentIpv4: z.string().max(64).nullable().optional(),
  ipv4Pool: z.string().max(128).nullable().optional(),
  createRadius: z.boolean().default(true)
});
