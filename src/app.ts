// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { json, urlencoded, raw } from "express";
import mongoose from "mongoose";
import { createServer } from "http";
import routes from "./routes/index";
import { ApiResponse } from "./core/types";
import {
  apiRateLimiter,
  securityHeaders,
  validateRequestSecurity,
  sanitizeInputs,
  errorHandler,
} from "./core/middleware";
import { authenticate } from "./middleware/auth";
import { logger } from "./core/utils/logger";
import { env } from "./config/environment";
import { databaseManager } from "./config/database";
import { notificationService } from "./services/notification.service";
import { initializeJobs, shutdownJobs } from "./modules/jobs";

const app = express();
const server = createServer(app);

// Initialize WebSocket server
notificationService.initialize(server);

// Trust proxy for rate limiting (when behind reverse proxy)
app.set("trust proxy", 1);

// Allow all origins (CORS first!)
app.use(
  cors({
    origin: "*", // or whitelist your frontends for production
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: false,
  })
);

// Security middleware (must be after CORS)
app.use(securityHeaders());
app.use(validateRequestSecurity());

// Basic Express middleware
app.use(helmet({ contentSecurityPolicy: false }));

if (env.isDevelopment()) {
  app.use(morgan("dev"));
}

// Configure body parsing with webhook-specific handling
// First, handle webhooks with raw body parsing
app.use("/api/webhook/stripe", raw({ type: "application/json" }));

// Handle workflow error webhook with JSON parsing
app.use("/api/webhook/workflow-error", json({ limit: "10mb" }));

// Handle SocialBu webhook with JSON parsing
app.use("/api/webhook/socialbu", json({ limit: "10mb" }));
app.use("/api/webhook/test", json({ limit: "10mb" }));
app.use("/api/video/generate-video", json({ limit: "1gb" }));

// Then handle all other routes with JSON parsing, explicitly excluding webhooks and file uploads
app.use((req, res, next) => {
  // Skip all body parsing middleware for webhook routes and file upload routes
  if (
    req.path &&
    (req.path.startsWith("/api/webhook") ||
      req.path === "/api/video/photo-avatar" ||
      req.path === "/api/video/generate-video")
  ) {
    next();
  } else {
    json({ limit: "10mb" })(req, res, next);
  }
});

// URL encoding for form data (also skip webhooks and file uploads)
app.use((req, res, next) => {
  if (
    req.path &&
    (req.path.startsWith("/api/webhook") ||
      req.path === "/api/video/photo-avatar" ||
      req.path === "/api/video/generate-video")
  ) {
    next();
  } else {
    urlencoded({ extended: true })(req, res, next);
  }
});

// Input sanitization (skip webhooks and file uploads to preserve raw data)
app.use((req, res, next) => {
  if (
    req.path &&
    (req.path.startsWith("/api/webhook") ||
      req.path === "/api/video/photo-avatar" ||
      req.path === "/api/video/generate-video")
  ) {
    next(); // Skip sanitization for webhooks and file uploads
  } else {
    sanitizeInputs()(req, res, next);
  }
});

// Rate limiting - Disable in serverless
if (!env.isProduction() || !process.env.VERCEL) {
  app.use("/api", apiRateLimiter);
}

// ---------- Routes ----------

// Health
app.get("/health", (_req, res) => {
  const healthResponse: ApiResponse = {
    success: true,
    message: "Express backend is running successfully",
  };
  res.json(healthResponse);
});

// MongoDB status endpoint
app.get("/mongo-status", async (_req, res) => {
  try {
    await databaseManager.connect();
    const status = databaseManager.getConnectionStatus();
    res.json({
      success: true,
      data: status,
      message: status.connected ? "MongoDB connected" : "MongoDB not connected",
    });
  } catch (error) {
    logger.error("MongoDB status check failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check MongoDB status",
    });
  }
});

// Always connect before /api routes
app.use(
  "/api",
  async (req, res, next) => {
    try {
      await databaseManager.connect();
      next();
    } catch (error) {
      logger.error("Database connection failed:", error);
      res.status(500).json({
        success: false,
        message: "Database connection failed",
      });
    }
  },
  authenticate(),
  routes
);

// Initialize background jobs and cron tasks
initializeJobs();

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  await shutdownJobs();
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  logger.info("SIGINT signal received: closing HTTP server");
  await shutdownJobs();
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

// 404
app.use((_req, res) => {
  const notFoundResponse: ApiResponse = {
    success: false,
    message: "Not Found",
  };
  res.status(404).json(notFoundResponse);
});

// Error handler
app.use(errorHandler);

const PORT = env.getRequired("PORT") as number;
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`✅ Express server with WebSocket running on port ${PORT}`);
});

export default app;
