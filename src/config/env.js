import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().optional(),
  MONGO_URI: z.string().optional(),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  ADMIN_CORS_ORIGIN: z.string().default("*"),
  MOCK_EXTERNALS: z
    .string()
    .transform((value) => value === "true")
    .default("true"),
  SEED_SUPERADMIN_USERNAME: z.string().min(3).default("admin"),
  SEED_SUPERADMIN_EMAIL: z.string().email().default("admin@example.com"),
  SEED_SUPERADMIN_PASSWORD: z.string().min(8).default("Netlayer@1411"),
  CRM_WEBHOOK_SECRET: z.string().optional(),
  JAZE_API_BASE_URL: z.string().url().optional(),
  JAZE_API_USERNAME: z.string().optional(),
  JAZE_API_KEY: z.string().optional(),
  JAZE_ACCOUNT_ID: z.string().optional(),
  JAZE_WEBHOOK_SECRET: z.string().optional(),
  SERVICE_CONTROL_PROVIDER: z.enum(["jaze", "radius"]).default("jaze"),
  RADIUS_SQL_HOST: z.string().default("127.0.0.1"),
  RADIUS_SQL_PORT: z.coerce.number().default(3306),
  RADIUS_SQL_USER: z.string().default("radius"),
  RADIUS_SQL_PASSWORD: z.string().default("Radius@123"),
  RADIUS_SQL_DATABASE: z.string().default("radius"),
  RADIUS_REJECT_MESSAGE: z.string().default("Service suspended"),
  USAGE_API_URL: z.string().url().optional(),
  GENIEACS_URL: z.string().url().optional(),
  GENIEACS_USERNAME: z.string().optional(),
  GENIEACS_PASSWORD: z.string().optional(),
  GENIEACS_JWT: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  INSTALLER_JWT_SECRET: z.string().optional(),
  ADMIN_DOMAIN: z.string().optional(),
  SALES_DOMAIN: z.string().optional(),
  NOC_DOMAIN: z.string().optional(),
  USER_DOMAIN: z.string().optional(),
  API_DOMAIN: z.string().optional(),
  ACS_DOMAIN: z.string().optional()
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  MONGODB_URI: parsed.MONGODB_URI || parsed.MONGO_URI
};

if (!env.MONGODB_URI) {
  throw new Error("MONGODB_URI or MONGO_URI is required");
}
