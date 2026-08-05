import { connectMongo } from "../db/mongoose.js";
import { AdminUser } from "../models/AdminUser.js";

async function main() {
  await connectMongo();
  const users = await AdminUser.find({});
  console.log("Admin Users in DB:", JSON.stringify(users.map(u => ({ username: u.username, email: u.email, status: u.status, roles: u.roles })), null, 2));
  process.exit(0);
}

main().catch(console.error);
