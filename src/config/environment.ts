import { EnvironmentConfig } from "../core/types";
import { logger } from "../core/utils/logger";

export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private config: EnvironmentConfig;

  private constructor() {
    try {
      this.config = this.loadEnvironmentConfig();
      this.validateConfig();
    } catch (error) {
      logger.error("Failed to load environment configuration:", error);
      logger.error(
        "Please make sure you have a .env file with all required variables"
      );
      logger.error("Copy env.example to .env and fill in the values");
      throw error;
    }
  }

  public static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  private loadEnvironmentConfig(): EnvironmentConfig {
    return {
      NODE_ENV: (process.env.NODE_ENV as any) || "development",
      PORT: parseInt(process.env.PORT || "4000", 10),
      JWT_SECRET: process.env.JWT_SECRET || "",
      MONGODB_URI: process.env.MONGODB_URI || "",
      REDIS_URL: process.env.REDIS_URL,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      EMAIL_HOST: process.env.EMAIL_HOST,
      EMAIL_PORT: process.env.EMAIL_PORT
        ? parseInt(process.env.EMAIL_PORT, 10)
        : undefined,
      EMAIL_USER: process.env.EMAIL_USER,
      EMAIL_PASS: process.env.EMAIL_PASS,
      FRONTEND_URL: process.env.FRONTEND_URL,
    };
  }

  private validateConfig(): void {
    const required = ["JWT_SECRET", "MONGODB_URI"];

    const missing = required.filter(
      (key) => !this.config[key as keyof EnvironmentConfig]
    );

    if (missing.length > 0) {
      const error = `Missing required environment variables: ${missing.join(
        ", "
      )}`;
      logger.error(error);
      logger.error("Please create a .env file. See env.example for reference.");
      logger.error("Run: cp env.example .env");

      // In development, provide defaults with warning
      if (this.isDevelopment()) {
        logger.warn(
          "⚠️  Using default values for missing variables (DEVELOPMENT ONLY)"
        );
        if (!this.config.JWT_SECRET) {
          this.config.JWT_SECRET =
            "development-jwt-secret-please-change-this-in-production-min-32-chars";
          logger.warn("⚠️  Using default JWT_SECRET - NOT SECURE!");
        }
        if (!this.config.MONGODB_URI) {
          this.config.MONGODB_URI = "mongodb://localhost:27017/edge-ai";
          logger.warn(
            "⚠️  Using default MONGODB_URI: mongodb://localhost:27017/edge-ai"
          );
        }
      } else {
        throw new Error(error);
      }
    }

    // Validate JWT_SECRET strength
    if (this.config.JWT_SECRET.length < 32) {
      if (this.isProduction()) {
        throw new Error(
          "JWT_SECRET must be at least 32 characters in production"
        );
      } else {
        logger.warn(
          "JWT_SECRET should be at least 32 characters long for security"
        );
      }
    }

    // Validate PORT
    if (this.config.PORT < 1 || this.config.PORT > 65535) {
      throw new Error("PORT must be between 1 and 65535");
    }

    logger.info("Environment configuration validated successfully");
  }

  public getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === "development";
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === "production";
  }

  public isTest(): boolean {
    return this.config.NODE_ENV === "test";
  }

  public get(key: keyof EnvironmentConfig): string | number | undefined {
    return this.config[key];
  }

  public getRequired(key: keyof EnvironmentConfig): string | number {
    const value = this.config[key];
    if (value === undefined || value === "") {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }
}

// Export singleton instance
export const env = EnvironmentManager.getInstance();

// Helper functions
export const isDevelopment = () => env.isDevelopment();
export const isProduction = () => env.isProduction();
export const isTest = () => env.isTest();
