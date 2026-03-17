import { z } from "zod";

export const updateConfigSchema = z.object({
  value: z.any(),
  valueType: z.enum(["string", "number", "boolean", "json"]),
  category: z.string().min(2)
});

export const updateSettingsSectionSchema = z.object({
  value: z.record(z.any())
});

export const updateNotificationEventSchema = z.object({
  label: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  audience: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  enabled: z.boolean().optional(),
  channels: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
    push: z.boolean().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export const updateTableViewSchema = z.object({
  label: z.string().min(2).optional(),
  defaultSortField: z.string().min(1).optional(),
  defaultSortDirection: z.enum(["asc", "desc"]).optional(),
  columns: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      visible: z.boolean().default(true),
      sortable: z.boolean().default(false),
      width: z.number().positive().optional()
    })
  ).min(1)
});
