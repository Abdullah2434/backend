import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { json, urlencoded, raw } from "express";
import mongoose from "mongoose";
import routes from "./routes/index";
import { ApiResponse } from "./types";
import {
  apiRateLimiter,
  ServerCSRFProtection,
  securityHeaders,
  validateRequest,
  sanitizeInputs,
} from "./middleware";
import cron from 'node-cron';
import { fetchAndStoreDefaultAvatars, fetchAndStoreDefaultVoices } from './cron/fetchDefaultAvatars';
import { checkPendingAvatarsAndUpdate } from './cron/checkAvatarStatus';
import './queues/photoAvatarWorker';

const app = express();

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
      "X-CSRF-Token",   // <-- add this
      "x-csrf-token"    // <-- lowercase too (some libs send lowercase)
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

// Then handle all other routes with JSON parsing, explicitly excluding webhooks
app.use((req, res, next) => {
  // Skip all body parsing middleware for webhook routes
  if (req.path && req.path.startsWith('/api/webhook')) {
    next();
  } else {
    json({ limit: "10mb" })(req, res, next);
  }
});

// URL encoding for form data (also skip webhooks)
app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/api/webhook')) {
    next();
  } else {
    urlencoded({ extended: true })(req, res, next);
  }
});

// Input sanitization (skip webhooks to preserve raw data)
app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/api/webhook')) {
    next(); // Skip sanitization for webhooks
  } else {
    sanitizeInputs()(req, res, next);
  }
});

// Rate limiting - Disable in serverless
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.use("/api", apiRateLimiter.middleware());
}

// CSRF protection - Disable in serverless
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.use(
    ServerCSRFProtection.middleware([
      "/api/video/download",
      "/api/video/status",
      "/api/webhook",
      "/api/subscription/confirm-payment-intent",
      "/api/subscription/payment-intent",
    ])
  );
}

// --------- MongoDB Connection (cached for Vercel) ----------
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  try {
    const mongoUri =
      "mongodb+srv://hrehman:gGcCAnzoQszAmdn4@cluster0.ieng9e7.mongodb.net/edgeai-realty?retryWrites=true&w=majority&appName=Cluster0";

    await mongoose.connect(mongoUri, {
      bufferCommands: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    isConnected = mongoose.connection.readyState === 1;
    console.log("✅ MongoDB connected successfully!");
  } catch (err: any) {
    console.error("❌ MongoDB connection error:", err.message);
  }
};

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
  await connectDB();

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
    await connectDB();
    next();
  },
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
cron.schedule('*/5 * * * *', async () => {
  console.log('Checking pending avatars status...');
  await checkPendingAvatarsAndUpdate();
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

export default app;
