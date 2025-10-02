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
import {
  apiRateLimiter,
  securityHeaders,
  validateRequest,
  sanitizeInputs,
  authenticate,
} from "./core/middlewares";
import { errorHandler } from "./core/errors";
import { notFoundHandler } from "./core/errors/error-handler";
import { response as ResponseHelper } from "./core/utils";
import { connectMongo } from "./database/connection";
import { notificationService } from "./modules/shared/notification";
import { cronService } from "./modules/shared/cron";
import { queueService } from "./modules/shared/queue";

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
app.use(validateRequest());

// Basic Express middleware
app.use(helmet({ contentSecurityPolicy: false }));

if (process.env.NODE_ENV !== "production") {
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

// Debug middleware for auth routes
app.use("/api/auth/reset-password", (req, res, next) => {
  console.log("🔍 Raw reset-password request:", {
    method: req.method,
    path: req.path,
    headers: {
      "content-type": req.headers["content-type"],
      "content-length": req.headers["content-length"],
    },
    body: req.body,
    bodyKeys: Object.keys(req.body || {}),
  });
  next();
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
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.use("/api", apiRateLimiter.middleware());
}

// ---------- Routes ----------

// Health
app.get("/health", (_req, res) => {
  ResponseHelper.success(res, null, "Express backend is running successfully");
});

// MongoDB status endpoint
app.get("/mongo-status", async (_req, res) => {
  await connectMongo();
  const status = {
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    connected: mongoose.connection.readyState === 1,
  };
  const message = status.connected
    ? "MongoDB connected"
    : "MongoDB not connected";
  ResponseHelper.success(res, status, message);
});

// Always connect before /api routes
app.use(
  "/api",
  async (req, res, next) => {
    await connectMongo();
    next();
  },
  authenticate(),
  routes
);

// Initialize services
cronService.initialize();
queueService.initialize();

// cron.schedule('0 23 * * 6', async () => {
//   console.log('Updating trend topics...');
//   await generateAndStoreTopicData();
// }); // Removed - now using API endpoint

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Express server with WebSocket running on port ${PORT}`);
});

export default app;
