import { z } from "zod";

export const createTicketSchema = z.object({
  customerId: z.string().min(2),
  serviceId: z.string().optional(),
  category: z.string().min(2),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  subject: z.string().min(3).max(200),
  description: z.string().min(5).max(5000)
});

export const assignTicketSchema = z.object({
  assignedToAdminId: z.string().min(8)
});

export const assignInstallerTicketSchema = z.object({
  mode: z.enum(["manual", "zone_pool"]).default("zone_pool"),
  installerId: z.string().min(8).optional(),
  note: z.string().min(2).max(1000).optional()
});

export const resolveTicketSchema = z.object({
  resolutionSummary: z.string().min(5).max(2000)
});

export const updateTicketSchema = z.object({
  status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assignedTeam: z.string().min(2).max(100).nullable().optional(),
  note: z.string().min(2).max(2000).optional()
});

export const closeTicketSchema = z.object({
  closeNote: z.string().min(2).max(2000).optional()
});
