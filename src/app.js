import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { requestContext } from "./common/requestContext.js";
import { authRouter } from "./modules/auth/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { customersRouter } from "./modules/customers/routes.js";
import { devicesRouter } from "./modules/devices/routes.js";
import { ticketsRouter } from "./modules/tickets/routes.js";
import { configsRouter } from "./modules/configs/routes.js";
import { approvalsRouter } from "./modules/approvals/routes.js";
import { auditRouter } from "./modules/audit/routes.js";
import { adminUsersRouter } from "./modules/adminUsers/routes.js";
import { adminInstallersRouter } from "./modules/adminInstallers/routes.js";
import { adminSalesRouter } from "./modules/adminSales/routes.js";
import { adminCatalogRouter } from "./modules/adminCatalog/routes.js";
import { adminOpsRouter } from "./modules/adminOps/routes.js";
import { customerPortalRouter } from "./modules/customerPortal/routes.js";
import { installerAuthRouter } from "./modules/installerAuth/routes.js";
import { installerAppRouter } from "./modules/installerApp/routes.js";
import { salesAppRouter } from "./modules/salesApp/routes.js";
import { ApiError } from "./common/ApiError.js";

export function createApp() {
  const app = express();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const publicDir = path.resolve(__dirname, "../public");
  const adminAppDir = path.join(publicDir, "admin-app");
  const adminAppIndex = path.join(adminAppDir, "index.html");
  const hasReactAdminBuild = () => existsSync(adminAppIndex);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "upgrade-insecure-requests": env.NODE_ENV === "production" && env.PORT === 443 ? [] : null
        }
      },
      hsts: env.NODE_ENV === "production" && env.PORT === 443 ? undefined : false
    })
  );
  app.use(cors({ origin: env.ADMIN_CORS_ORIGIN === "*" ? true : env.ADMIN_CORS_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestContext);
  app.use(morgan("combined"));
  app.use(express.static(publicDir));

  app.get("/", (req, res) => {
    const host = (req.hostname || "").toLowerCase();
    if (host === env.ADMIN_DOMAIN || host === env.NOC_DOMAIN) {
      return res.redirect("/admin");
    }
    if (host === env.SALES_DOMAIN) {
      return res.redirect("/sales");
    }
    if (host === env.USER_DOMAIN) {
      return res.redirect("/user");
    }
    return res.redirect("/admin");
  });

  app.get("/health/live", (_req, res) => {
    res.json({ success: true, data: { status: "live" } });
  });

  app.get("/health/ready", (_req, res) => {
    res.json({ success: true, data: { status: "ready" } });
  });

  app.use("/api/v1/admin/auth", authRouter);
  app.use("/api/v1/admin/dashboard", dashboardRouter);
  app.use("/api/v1/admin/customers", customersRouter);
  app.use("/api/v1/admin/devices", devicesRouter);
  app.use("/api/v1/admin/tickets", ticketsRouter);
  app.use("/api/v1/admin/configs", configsRouter);
  app.use("/api/v1/admin/approvals", approvalsRouter);
  app.use("/api/v1/admin/audit", auditRouter);
  app.use("/api/v1/admin", adminUsersRouter);
  app.use("/api/v1/admin", adminInstallersRouter);
  app.use("/api/v1/admin", adminSalesRouter);
  app.use("/api/v1/admin", adminCatalogRouter);
  app.use("/api/v1/admin", adminOpsRouter);
  app.use("/api/v1/installer/auth", installerAuthRouter);
  app.use("/api/v1/installer", installerAppRouter);
  app.use("/api/v1/customer", customerPortalRouter);
  app.use("/api/v1/sales", salesAppRouter);

  app.get("/admin", (_req, res) => {
    res.sendFile(path.join(publicDir, "admin", "index.html"));
  });

  app.get("/admin-next", (_req, res) => {
    const target = hasReactAdminBuild() ? adminAppIndex : path.join(publicDir, "admin", "index.html");
    res.sendFile(target);
  });

  app.get("/admin-next/*", (_req, res) => {
    const target = hasReactAdminBuild() ? adminAppIndex : path.join(publicDir, "admin", "index.html");
    res.sendFile(target);
  });

  app.get("/user", (_req, res) => {
    res.sendFile(path.join(publicDir, "user", "index.html"));
  });

  app.get("/user/login", (_req, res) => {
    res.sendFile(path.join(publicDir, "user", "index.html"));
  });

  app.get("/sales", (_req, res) => {
    res.sendFile(path.join(publicDir, "sales", "index.html"));
  });

  app.get("/noc", (_req, res) => {
    res.sendFile(path.join(publicDir, "admin", "index.html"));
  });

  app.use((_req, _res, next) => {
    next(new ApiError(404, "Route not found"));
  });

  app.use((error, _req, res, _next) => {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        message: error.message || "Internal server error",
        details: error.details
      }
    });
  });

  return app;
}
