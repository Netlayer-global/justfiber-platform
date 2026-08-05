import mysql from "mysql2/promise";
import { env } from "../config/env.js";

async function check() {
  console.log("Connecting to:", env.RADIUS_SQL_HOST, env.RADIUS_SQL_PORT);
  const connection = await mysql.createConnection({
    host: env.RADIUS_SQL_HOST,
    port: env.RADIUS_SQL_PORT,
    user: env.RADIUS_SQL_USER,
    password: env.RADIUS_SQL_PASSWORD,
    database: env.RADIUS_SQL_DATABASE,
  });

  try {
    const [tables] = await connection.execute("SHOW TABLES");
    console.log("Tables in database:", tables);
    
    // Check if nas table exists
    const hasNasTable = tables.some(t => Object.values(t)[0] === "nas");
    if (hasNasTable) {
      console.log("nas table exists! Describing table...");
      const [desc] = await connection.execute("DESCRIBE nas");
      console.log(desc);
      const [rows] = await connection.execute("SELECT * FROM nas");
      console.log("Current rows in nas:", rows);
    } else {
      console.log("nas table does NOT exist in the database!");
    }
  } catch (err) {
    console.error("Error during check:", err);
  } finally {
    await connection.end();
  }
}

check().catch(console.error);
