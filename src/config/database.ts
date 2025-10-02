import mongoose from "mongoose";
import { DatabaseConfig, EnvironmentConfig } from "../core/types";
import { logger } from "../core/utils/logger";

let cached: typeof mongoose | null = null;

export class DatabaseManager {
  private static instance: DatabaseManager;
  private config: DatabaseConfig;

  private constructor() {
    this.config = this.getDatabaseConfig();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private getDatabaseConfig(): DatabaseConfig {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is required");
    }

    return {
      uri,
      options: {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferCommands: true,
      },
    };
  }

  public async connect(): Promise<typeof mongoose> {
    if (cached) {
      logger.info("Using cached database connection");
      return cached;
    }

    try {
      logger.info("Connecting to MongoDB...");

      mongoose.set("strictQuery", true);

      cached = await mongoose.connect(this.config.uri, this.config.options);

      logger.info("Successfully connected to MongoDB");

      // Handle connection events
      mongoose.connection.on("error", (error) => {
        logger.error("MongoDB connection error:", error);
      });

      mongoose.connection.on("disconnected", () => {
        logger.warn("MongoDB disconnected");
        cached = null;
      });

      mongoose.connection.on("reconnected", () => {
        logger.info("MongoDB reconnected");
      });

      return cached;
    } catch (error) {
      logger.error("Failed to connect to MongoDB:", error);
      cached = null;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (cached) {
      await mongoose.disconnect();
      cached = null;
      logger.info("Disconnected from MongoDB");
    }
  }

  public getConnectionStatus(): {
    readyState: number;
    host: string;
    port: number;
    name: string;
    connected: boolean;
  } {
    const connection = mongoose.connection;
    return {
      readyState: connection.readyState,
      host: connection.host,
      port: connection.port,
      name: connection.name,
      connected: connection.readyState === 1,
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!cached) {
        await this.connect();
      }

      // Simple ping to check connection
      await mongoose.connection.db?.admin().ping();
      return true;
    } catch (error) {
      logger.error("Database health check failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();

// Legacy function for backward compatibility
export async function connectMongo(): Promise<typeof mongoose> {
  return databaseManager.connect();
}
