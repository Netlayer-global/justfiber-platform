import { Role } from "../models/Role.js";
import { SystemConfig } from "../models/SystemConfig.js";
import { systemRoles } from "../config/permissions.js";

export async function seedSystemData() {
  for (const role of systemRoles) {
    await Role.updateOne(
      { code: role.code },
      { $set: { name: role.name, permissions: role.permissions, isSystem: true } },
      { upsert: true }
    );
  }

  const defaults = [
    {
      key: "admin.approval.required_actions",
      value: ["bulk_suspend", "bulk_resume", "config_sensitive_update"],
      valueType: "json",
      category: "policy"
    },
    {
      key: "admin.retry.max_attempts",
      value: 5,
      valueType: "number",
      category: "policy"
    }
  ];

  for (const config of defaults) {
    await SystemConfig.updateOne(
      { key: config.key },
      { $setOnInsert: { ...config } },
      { upsert: true }
    );
  }
}
