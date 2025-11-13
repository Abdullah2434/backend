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
import { ApiResponse } from "./types";
import {
  apiRateLimiter,
  videoAvatarRateLimiter,
  securityHeaders,
  validateRequest,
  sanitizeInputs,
  authenticate,
} from "./middleware";
import cron from "node-cron";
import {
  fetchAndStoreDefaultAvatars,
  fetchAndStoreDefaultVoices,
} from "./cron/fetchDefaultAvatars";
import { checkPendingAvatarsAndUpdate } from "./cron/checkAvatarStatus";
import { startAllCronJobs } from "./cron/processScheduledVideos";
import { startSubscriptionSync } from "./cron/syncSubscriptions";
import { startHeyGenAvatarSyncCron } from "./cron/syncHeyGenAvatars";
import { startElevenLabsVoicesSyncCron } from "./cron/fetchElevenLabsVoices";
import "./queues/photoAvatarWorker";
import { connectMongo } from "./config/mongoose";
import { notificationService } from "./services/notification.service";
// import { generateAndStoreTopicData } from './cron/generateTopicData'; // Removed - now using API endpoint

const app = express();
const server = createServer(app);

// Set server-level timeout (default is 2 minutes, increase for long-running requests)
server.setTimeout(600000); // 10 minutes
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

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
      "x-timezone",
      "timezone",
      "X-Timezone",
      "x-api-key",
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

// Handle workflow error webhook with JSON parsing
app.use("/api/webhook/workflow-error", json({ limit: "10mb" }));

// Handle SocialBu webhook with JSON parsing
app.use("/api/webhook/socialbu", json({ limit: "10mb" }));
app.use("/api/webhook/test", json({ limit: "10mb" }));
app.use("/api/video/generate-video", json({ limit: "1gb" }));

// Handle video avatar endpoint with URL-encoded parsing for form data
app.use("/api/v2/video_avatar", urlencoded({ extended: true, limit: "1gb" }));

// Special middleware for video avatar endpoint to handle large files
app.use("/api/v2/video_avatar", (req, res, next) => {
  

  // Set specific headers for large file uploads
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Increase timeout for this specific endpoint
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000); // 10 minutes

  next();
});

// Special middleware for schedule edit endpoint to handle dynamic caption generation
app.use((req, res, next) => {
  // Check if this is the schedule edit endpoint (PUT /api/schedule/:scheduleId/post/:postId)
  if (
    req.method === "PUT" &&
    req.path &&
    req.path.match(/^\/api\/schedule\/[^/]+\/post\/[^/]+$/)
  ) {
    // Increase timeout for dynamic caption generation (OpenAI API calls)
    req.setTimeout(600000); // 10 minutes
    res.setTimeout(600000); // 10 minutes
    console.log(`⏱️ Increased timeout for schedule edit endpoint: ${req.path}`);
  }
  next();
});

// Then handle all other routes with JSON parsing, explicitly excluding webhooks and file uploads
app.use((req, res, next) => {
  // Skip all body parsing middleware for webhook routes and file upload routes
  if (
    req.path &&
    (req.path.startsWith("/api/webhook") ||
      req.path === "/api/video/photo-avatar" ||
      req.path === "/api/video/generate-video" ||
      req.path === "/api/v2/video_avatar")
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
      req.path === "/api/video/generate-video" ||
      req.path === "/api/v2/video_avatar")
  ) {
    next();
  } else {
    urlencoded({ extended: true })(req, res, next);
  }
});

// Input sanitization (skip webhooks, file uploads, and text-to-speech to preserve raw data)
app.use((req, res, next) => {
  if (
    req.path &&
    (req.path.startsWith("/api/webhook") ||
      req.path === "/api/video/photo-avatar" ||
      req.path === "/api/video/generate-video" ||
      req.path === "/api/elevenlabs/text-to-speech" ||
      req.path.startsWith("/api/elevenlabs/text-to-speech"))
  ) {
    next(); // Skip sanitization for webhooks, file uploads, and TTS endpoints
  } else {
    sanitizeInputs()(req, res, next);
  }
});

// Rate limiting - Disable in serverless
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.use("/api", apiRateLimiter.middleware());

  // Video avatar endpoint - NO rate limiting (permanently disabled)
  console.log("⚠️ Video avatar rate limiting is DISABLED");
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
// cron.schedule("55 14 * * 2", async () => {
//   console.log("Weekly avatar sync job started...");
//   await fetchAndStoreDefaultAvatars();
//   console.log("Weekly avatar sync job finished.");
//   console.log("Weekly voice sync job started...");
//   await fetchAndStoreDefaultVoices();
//   console.log("Weekly voice sync job finished.");
// });

// Schedule avatar status check every 5 minutes
cron.schedule("*/2 * * * *", async () => {
  console.log("Checking pending avatars status...");
  await checkPendingAvatarsAndUpdate();
});

// Start HeyGen avatar sync cron job (runs every 12 hours)
startHeyGenAvatarSyncCron();

// Start scheduled video processing cron jobs
startAllCronJobs();

// Start subscription sync cron job (syncs subscriptions from Stripe hourly)
// This handles recurring payments automatically processed by Stripe
startSubscriptionSync();

// Start ElevenLabs voices sync cron job (runs at 11:03 AM and 11:03 PM - every 12 hours)
// Fetches voices from API, adds new ones, updates existing ones, and removes deleted ones (except cloned)
startElevenLabsVoicesSyncCron();

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
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Express server with WebSocket running on port ${PORT}`);
});

export default app;
