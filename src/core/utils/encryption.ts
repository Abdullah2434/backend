// ==================== ENCRYPTION UTILITY ====================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export class EncryptionHelper {
  // ==================== PASSWORD HASHING ====================

  static async hashPassword(password: string): Promise<string> {
    const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
    return bcrypt.hash(password, rounds);
  }

  static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // ==================== JWT TOKEN MANAGEMENT ====================

  static generateToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
    const secret = process.env.JWT_SECRET || "your-secret-key";
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  static verifyToken(token: string): TokenPayload {
    const secret = process.env.JWT_SECRET || "your-secret-key";
    return jwt.verify(token, secret) as TokenPayload;
  }

  static decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  // ==================== RANDOM STRING GENERATION ====================

  static generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  static generateRandomBytes(length: number = 16): Buffer {
    return crypto.randomBytes(length);
  }

  // ==================== SECRET KEY GENERATION ====================

  static generateSecretKey(): string {
    return this.generateRandomString(64);
  }

  // ==================== HASH GENERATION ====================

  static generateHash(data: string, algorithm: string = "sha256"): string {
    return crypto.createHash(algorithm).update(data).digest("hex");
  }
}

export default EncryptionHelper;
