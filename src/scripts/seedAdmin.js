import argon2 from "argon2";
import { connectMongo } from "../db/mongoose.js";
import { env } from "../config/env.js";
import { seedSystemData } from "../bootstrap/seedSystem.js";
import { AdminUser } from "../models/AdminUser.js";

async function main() {
  await connectMongo();
  await seedSystemData();
  const existing = await AdminUser.findOne({
    $or: [{ email: env.SEED_SUPERADMIN_EMAIL }, { username: env.SEED_SUPERADMIN_USERNAME }]
  });
  if (existing) {
    console.log(`Super admin already exists: ${existing.username}`);
    process.exit(0);
  }
  const passwordHash = await argon2.hash(env.SEED_SUPERADMIN_PASSWORD);
  await AdminUser.create({
    username: env.SEED_SUPERADMIN_USERNAME,
    fullName: "Platform Super Admin",
    email: env.SEED_SUPERADMIN_EMAIL,
    passwordHash,
    roles: ["super_admin"],
    status: "active"
  });
  console.log(`Super admin created: ${env.SEED_SUPERADMIN_USERNAME}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
