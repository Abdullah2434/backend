// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { json, urlencoded, raw } from "express";
import mongoose from "mongoose";
import { createServer } from "http";
import routes from "./routes/index";
import { ApiResponse } from "./types";
import {
  apiRateLimiter,
  securityHeaders,
  validateRequest,
  sanitizeInputs,
  authenticate,
} from "./middleware";
import cron from 'node-cron';
import { fetchAndStoreDefaultAvatars, fetchAndStoreDefaultVoices } from './cron/fetchDefaultAvatars';
import { checkPendingAvatarsAndUpdate } from './cron/checkAvatarStatus';
import './queues/photoAvatarWorker';
import { connectMongo } from './config/mongoose';
import { notificationService } from './services/notification.service';
// import { generateAndStoreTopicData } from './cron/generateTopicData'; // Removed - now using API endpoint

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
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
    ],
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
app.use('/api/webhook/stripe', raw({ type: 'application/json' }));

// Handle workflow error webhook with JSON parsing
app.use('/api/webhook/workflow-error', json({ limit: "10mb" }));

// Then handle all other routes with JSON parsing, explicitly excluding webhooks and file uploads
app.use((req, res, next) => {
  // Skip all body parsing middleware for webhook routes and file upload routes
  if (req.path && (req.path.startsWith('/api/webhook') || req.path === '/api/video/photo-avatar')) {
    next();
  } else {
    json({ limit: "10mb" })(req, res, next);
  }
});

// URL encoding for form data (also skip webhooks and file uploads)
app.use((req, res, next) => {
  if (req.path && (req.path.startsWith('/api/webhook') || req.path === '/api/video/photo-avatar')) {
    next();
  } else {
    urlencoded({ extended: true })(req, res, next);
  }
});

// Input sanitization (skip webhooks and file uploads to preserve raw data)
app.use((req, res, next) => {
  if (req.path && (req.path.startsWith('/api/webhook') || req.path === '/api/video/photo-avatar')) {
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
  const healthResponse: ApiResponse = {
    success: true,
    message: "Express backend is running successfully",
  };
  res.json(healthResponse);
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
  res.json({
    success: true,
    data: status,
    message: status.connected ? "MongoDB connected" : "MongoDB not connected",
  });
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

// Schedule weekly avatar and voice sync (every Sunday at 2:17 PM)
cron.schedule('55 14 * * 2', async () => {
  console.log('Weekly avatar sync job started...');
  await fetchAndStoreDefaultAvatars();
  console.log('Weekly avatar sync job finished.');
  console.log('Weekly voice sync job started...');
  await fetchAndStoreDefaultVoices();
  console.log('Weekly voice sync job finished.');
});

// Schedule avatar status check every 5 minutes
cron.schedule('*/2 * * * *', async () => {
  console.log('Checking pending avatars status...');
  await checkPendingAvatarsAndUpdate();
});

// cron.schedule('0 23 * * 6', async () => {
//   console.log('Updating trend topics...');
//   await generateAndStoreTopicData();
// }); // Removed - now using API endpoint

// 404
app.use((_req, res) => {
  const notFoundResponse: ApiResponse = {
    success: false,
    message: "Not Found",
  };
  res.status(404).json(notFoundResponse);
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);

    const errorResponse: ApiResponse = {
      success: false,
      message: err.message || "Internal server error",
    };
    res.status(err.status || 500).json(errorResponse);
  }
);

const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Express server with WebSocket running on port ${PORT}`);
});

export default app;
