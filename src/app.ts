import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { json, urlencoded } from "express";
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

const app = express();

// Trust proxy for rate limiting (when behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware (must be first)
app.use(securityHeaders());
app.use(validateRequest());

// Basic Express middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: false,
  })
);
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Body parsing middleware
app.use(json({ limit: "10mb" }));
app.use(urlencoded({ extended: true }));

// Input sanitization
app.use(sanitizeInputs());

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
