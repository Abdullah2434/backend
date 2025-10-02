import jwt from "jsonwebtoken";
import { env } from "../../../config/environment";
import { JwtPayload } from "../types/auth.types";

export class TokenService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = env.getRequired("JWT_SECRET") as string;
  }

  /**
   * Generate access token (7 days expiration)
   */
  generateAccessToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, this.jwtSecret, { expiresIn: "7d" });
  }

  /**
   * Generate reset token (15 minutes expiration)
   */
  generateResetToken(userId: string, email: string): string {
    return jwt.sign({ userId, email, type: "reset" }, this.jwtSecret, {
      expiresIn: "15m",
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<boolean> {
    try {
      const payload = this.verifyToken(token);
      return !!payload && !payload.type; // Not a reset token
    } catch {
      return false;
    }
  }

  /**
   * Validate reset token
   */
  async validateResetToken(token: string): Promise<boolean> {
    try {
      const payload = this.verifyToken(token);
      return !!payload && payload.type === "reset";
    } catch {
      return false;
    }
  }
}

export const tokenService = new TokenService();
