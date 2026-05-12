import path from "path";
import { fileURLToPath } from "url";
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
import { paymentRouter } from "./modules/adminOps/paymentRoutes.js";
import { platformFoundationRouter } from "./modules/platformFoundation/routes.js";
import { customerPortalRouter } from "./modules/customerPortal/routes.js";
import { installerAuthRouter } from "./modules/installerAuth/routes.js";
import { installerAppRouter } from "./modules/installerApp/routes.js";
import { salesAppRouter } from "./modules/salesApp/routes.js";
import { jazeWebhookRouter } from "./modules/webhooks/jazeWebhookRoutes.js";
import { smartfloWebhookRouter } from "./modules/webhooks/smartfloWebhookRoutes.js";
import { ApiError } from "./common/ApiError.js";

function resolveCorsOrigin(originValue) {
  if (!originValue || originValue === "*") {
    return true;
  }
  const allowed = originValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowed.length) {
    return true;
  }
  return (origin, callback) => {
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("CORS origin not allowed"));
  };
}

export function createApp() {
  const app = express();

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
  app.use(cors({ origin: resolveCorsOrigin(env.ADMIN_CORS_ORIGIN) }));
  app.use(
    express.json({
      limit: "25mb",
      verify: (req, _res, buf) => {
        if (req.originalUrl === "/api/v1/customer/webhooks/razorpay") {
          req.rawBody = Buffer.from(buf);
        }
      }
    })
  );
  app.use(requestContext);
  app.use(morgan("combined"));

  app.get("/", (_req, res) => {
    res.json({
      success: true,
      data: {
        service: "justfiber-api",
        health: "/health/live",
        versionPrefix: "/api/v1"
      }
    });
  });

  app.get("/health/live", (_req, res) => {
    res.json({ success: true, data: { status: "live" } });
  });

  const publicRoot = path.dirname(fileURLToPath(new URL("./../public/index.html", import.meta.url)));

  app.use("/admin", express.static(path.join(publicRoot, "admin"), { index: "index.html" }));
  app.use("/user", express.static(path.join(publicRoot, "user"), { index: "index.html" }));
  app.use("/sales", express.static(path.join(publicRoot, "sales"), { index: "index.html" }));
  app.get("/noc", (_req, res) => {
    res.sendFile(path.join(publicRoot, "admin", "index.html"));
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
  app.use("/api/v1/admin/payments", paymentRouter);
  app.use("/api/v1/admin", platformFoundationRouter);
  app.use("/api/v1/installer/auth", installerAuthRouter);
  app.use("/api/v1/installer", installerAppRouter);
  app.use("/api/v1/customer", customerPortalRouter);
  app.use("/api/v1/sales", salesAppRouter);
  app.use("/api/v1/webhooks", jazeWebhookRouter);
  app.use("/api/v1/webhooks", smartfloWebhookRouter);

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
