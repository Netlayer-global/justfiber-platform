import { z } from "zod";

export const sendOtpSchema = z.object({
  mobile: z.string().min(8).optional(),
  email: z.string().email().optional()
});

export const verifyOtpSchema = z.object({
  mobile: z.string().min(8).optional(),
  email: z.string().email().optional(),
  otp: z.string().length(6),
  fullName: z.string().optional()
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(10)
});

export const feasibilitySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().min(5)
});

export const feasibilityLeadSchema = z.object({
  fullName: z.string().min(2),
  mobile: z.string().min(8),
  email: z.string().email().optional(),
  address: z.string().min(5),
  pinCode: z.string().min(4),
  lat: z.number(),
  lng: z.number()
});

export const bookingSchema = z.object({
  planCode: z.string().min(2),
  fullName: z.string().min(2),
  mobile: z.string().min(8),
  email: z.string().email().optional(),
  fullAddress: z.string().min(5),
  pinCode: z.string().min(4),
  lat: z.number(),
  lng: z.number(),
  preferredDate: z.string().min(4).optional(),
  preferredSlotCode: z.string().min(2).optional(),
  preferredSlotLabel: z.string().min(2).optional(),
  durationMonths: z.number().int().positive().optional(),
  durationLabel: z.string().min(2).optional(),
  paymentMode: z.enum(["razorpay", "cash"]).default("razorpay")
});

export const bookingPaymentLinkSchema = z.object({});

export const bookingPaymentOrderSchema = z.object({
  amount: z.number().positive().optional()
});

export const bookingPaymentConfirmSchema = z.object({
  status: z.enum(["paid", "failed"]),
  paymentId: z.string().optional(),
  reference: z.string().optional(),
  amount: z.number().positive().optional(),
  notes: z.string().optional()
});

export const bookingPaymentVerifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  amount: z.number().positive().optional(),
  notes: z.string().optional()
});

export const bookingPreferenceSchema = z.object({
  preferredDate: z.string().min(4).optional(),
  preferredSlotCode: z.string().min(2).optional(),
  preferredSlotLabel: z.string().min(2).optional()
});

export const billingPaymentLinkSchema = z.object({
  customerId: z.string().optional()
});

export const billingPaymentOrderSchema = z.object({
  customerId: z.string().optional(),
  amount: z.number().positive().optional()
});

export const billingPaymentVerifySchema = z.object({
  customerId: z.string().optional(),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  amount: z.number().positive().optional(),
  notes: z.string().optional()
});

export const billingPaymentConfirmSchema = z.object({
  customerId: z.string().optional(),
  paymentId: z.string().optional(),
  reference: z.string().optional(),
  amount: z.number().positive().optional(),
  notes: z.string().optional()
});

export const wifiUpdateSchema = z.object({
  sameSsidMode: z.boolean().optional(),
  ssid24: z.string().min(3).optional(),
  password24: z.string().min(8).optional(),
  ssid5: z.string().min(3).optional(),
  password5: z.string().min(8).optional()
});

export const wifiPauseSchema = z.object({
  paused: z.coerce.boolean()
});

export const guestWifiSchema = z.object({
  enabled: z.coerce.boolean(),
  ssid: z.string().min(3).max(64).optional(),
  password: z.string().min(8).max(64).optional()
});

export const parentalControlSchema = z.object({
  mode: z.enum(["replace", "append"]).default("append"),
  rules: z.array(
    z.object({
      targetName: z.string().min(2).max(100),
      macAddress: z.string().min(8).max(32).optional(),
      blocked: z.coerce.boolean().default(true),
      startTime: z.string().min(3).max(20).optional(),
      endTime: z.string().min(3).max(20).optional(),
      days: z.array(z.string().min(2).max(12)).optional()
    })
  ).min(1)
});

export const deviceAccessSchema = z.object({
  clientId: z.string().min(2).max(100),
  blocked: z.coerce.boolean()
});

export const planChangeSchema = z.object({
  planCode: z.string().min(2),
  effectiveMode: z.enum(["immediate", "next_cycle"]).default("next_cycle"),
  billingTerm: z.enum(["monthly", "quarterly", "halfYearly", "yearly"]).default("monthly")
});

export const serviceRequestSchema = z.object({
  type: z.enum(["shift", "disconnect", "complaint", "link_service"]),
  note: z.string().min(3).optional(),
  payload: z.record(z.any()).optional()
});

export const supportTicketSchema = z.object({
  category: z.string().min(2),
  subject: z.string().min(3),
  description: z.string().min(5)
});

export const addonRequestSchema = z.object({
  addonCode: z.string().min(2),
  quantity: z.number().min(1).default(1)
});
