import * as jwt from "jsonwebtoken";
import { JwtPayload, AuthConfig } from "../types/auth.types";

export class AuthTokenService {
  private readonly config: AuthConfig;

  constructor() {
    this.config = {
      jwtSecret: process.env.JWT_SECRET as string,
      tokenExpiry: "7d",
      resetTokenExpiry: "15m",
      bcryptRounds: 12,
      emailVerificationExpiry: 24 * 60 * 60 * 1000, // 24 hours
      passwordResetExpiry: 15 * 60 * 1000, // 15 minutes
    };

    if (!this.config.jwtSecret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
  }

  // ==================== TOKEN MANAGEMENT ====================

  generateToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, this.config.jwtSecret, {
      expiresIn: this.config.tokenExpiry,
    } as jwt.SignOptions);
  }

  generateResetToken(userId: string, email: string): string {
    return jwt.sign({ userId, email, type: "reset" }, this.config.jwtSecret, {
      expiresIn: this.config.resetTokenExpiry,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.config.jwtSecret) as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  // ==================== CONFIGURATION ====================

  getConfig(): AuthConfig {
    return { ...this.config };
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      jwt: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      // Test JWT functionality
      const testToken = this.generateToken("test", "test@example.com");
      const verified = this.verifyToken(testToken);

      return {
        status: verified ? "healthy" : "unhealthy",
        services: {
          jwt: verified ? "available" : "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          jwt: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default AuthTokenService;
