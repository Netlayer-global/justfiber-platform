import { connectMongo } from "../db/mongoose.js";
import { AdminUser } from "../models/AdminUser.js";
import argon2 from "argon2";

async function main() {
  await connectMongo();
  const admin = await AdminUser.findOne({ username: "admin" });
  if (!admin) {
    console.log("No user with username admin found");
    process.exit(0);
  }
  const isMatch = await argon2.verify(admin.passwordHash, "Netlayer@1411");
  console.log("Argon2 verify matches for 'Netlayer@1411':", isMatch);
  process.exit(0);
}

main().catch(console.error);
