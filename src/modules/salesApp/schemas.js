import { z } from "zod";

export const salesLoginSchema = z.object({
  login: z.string().min(3),
  password: z.string().min(8)
});

export const salesLeadSchema = z.object({
  fullName: z.string().min(2),
  mobile: z.string().min(8),
  email: z.string().email().optional(),
  address: z.string().min(5),
  pinCode: z.string().min(4),
  lat: z.number(),
  lng: z.number(),
  planCode: z.string().min(2),
  notes: z.string().optional()
});

export const salesKycSchema = z.object({
  documentType: z.string().min(2),
  documentNumber: z.string().min(3),
  frontImageUrl: z.string().url(),
  backImageUrl: z.string().url().optional(),
  selfieImageUrl: z.string().url().optional()
});

export const salesBookingPaymentLinkSchema = z.object({}).passthrough();

export const salesBookingPaymentConfirmSchema = z.object({
  status: z.enum(["paid", "failed"]),
  paymentId: z.string().optional(),
  reference: z.string().optional(),
  amount: z.number().positive().optional(),
  notes: z.string().optional()
});
