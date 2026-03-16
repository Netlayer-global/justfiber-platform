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

export const feasibilitySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().min(5)
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
  paymentMode: z.enum(["jaze", "razorpay", "cash"]).default("razorpay")
});

export const wifiUpdateSchema = z.object({
  sameSsidMode: z.boolean().optional(),
  ssid24: z.string().min(3).optional(),
  password24: z.string().min(8).optional(),
  ssid5: z.string().min(3).optional(),
  password5: z.string().min(8).optional()
});

export const planChangeSchema = z.object({
  planCode: z.string().min(2),
  effectiveMode: z.enum(["immediate", "next_cycle"]).default("next_cycle")
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
