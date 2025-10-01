import crypto from "crypto";
import bcrypt from "bcryptjs";
import { UserResponse } from "../types/auth.types";

// ==================== PASSWORD UTILITIES ====================

export const hashPassword = async (
  password: string,
  rounds: number = 12
): Promise<string> => {
  return bcrypt.hash(password, rounds);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateRandomPassword = (length: number = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};

// ==================== TOKEN UTILITIES ====================

export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};

export const generateEmailVerificationToken = (): string => {
  return generateSecureToken(32);
};

export const generatePasswordResetToken = (): string => {
  return generateSecureToken(32);
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// ==================== EMAIL UTILITIES ====================

export const isValidEmail = (email: string): boolean => {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
};

export const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const isDisposableEmail = (email: string): boolean => {
  const disposableDomains = [
    "10minutemail.com",
    "tempmail.org",
    "guerrillamail.com",
    "mailinator.com",
    "temp-mail.org",
    "throwaway.email",
    "getnada.com",
    "maildrop.cc",
    "yopmail.com",
    "sharklasers.com",
    "guerrillamailblock.com",
    "pokemail.net",
    "spam4.me",
    "bccto.me",
    "chacuo.net",
    "dispostable.com",
    "mailnesia.com",
    "mailcatch.com",
    "inboxalias.com",
    "mailmetrash.com",
    "trashmail.net",
  ];

  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? disposableDomains.includes(domain) : false;
};

// ==================== PASSWORD STRENGTH UTILITIES ====================

export const checkPasswordStrength = (
  password: string
): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} => {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push("Password should be at least 8 characters long");
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Character variety checks
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain uppercase letters");
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain numbers");
  }

  if (/[@$!%*?&]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain special characters (@$!%*?&)");
  }

  // Common password check
  const commonPasswords = [
    "password",
    "123456",
    "123456789",
    "qwerty",
    "abc123",
    "password123",
    "admin",
    "letmein",
    "welcome",
    "monkey",
    "1234567890",
    "dragon",
    "master",
    "hello",
    "freedom",
    "whatever",
    "qazwsx",
    "trustno1",
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    score = Math.max(0, score - 2);
    feedback.push("Password is too common");
  }

  // Sequential characters check
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push("Password should not contain repeated characters");
  }

  // Keyboard patterns check
  const keyboardPatterns = ["qwerty", "asdfgh", "zxcvbn", "123456", "abcdef"];

  for (const pattern of keyboardPatterns) {
    if (password.toLowerCase().includes(pattern)) {
      score = Math.max(0, score - 1);
      feedback.push("Password should not contain keyboard patterns");
      break;
    }
  }

  return {
    score,
    feedback,
    isStrong: score >= 4,
  };
};

// ==================== NAME UTILITIES ====================

export const isValidName = (name: string): boolean => {
  return /^[a-zA-Z\s'-]+$/.test(name) && name.length >= 1 && name.length <= 50;
};

export const sanitizeName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/[^a-zA-Z\s'-]/g, ""); // Remove invalid characters
};

// ==================== PHONE UTILITIES ====================

export const isValidPhone = (phone: string): boolean => {
  const digitsOnly = phone.replace(/\D/g, "");
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
};

export const sanitizePhone = (phone: string): string => {
  return phone.replace(/\D/g, ""); // Keep only digits
};

export const formatPhone = (phone: string): string => {
  const digits = sanitizePhone(phone);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

// ==================== USER UTILITIES ====================

export const formatUserResponse = (user: any): UserResponse => {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone || "",
    isEmailVerified: user.isEmailVerified,
    googleId: user.googleId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const sanitizeUserData = (userData: any): any => {
  const sanitized = { ...userData };

  if (sanitized.firstName) {
    sanitized.firstName = sanitizeName(sanitized.firstName);
  }

  if (sanitized.lastName) {
    sanitized.lastName = sanitizeName(sanitized.lastName);
  }

  if (sanitized.email) {
    sanitized.email = normalizeEmail(sanitized.email);
  }

  if (sanitized.phone) {
    sanitized.phone = sanitizePhone(sanitized.phone);
  }

  return sanitized;
};

// ==================== DATE UTILITIES ====================

export const isTokenExpired = (expiryDate: Date): boolean => {
  return new Date() > expiryDate;
};

export const getTokenExpiry = (hours: number = 24): Date => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

// ==================== SECURITY UTILITIES ====================

export const generateCSRFToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const generateSessionId = (): string => {
  return crypto.randomBytes(16).toString("hex");
};

export const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return email;
  }

  const maskedLocal =
    localPart[0] +
    "*".repeat(localPart.length - 2) +
    localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
};

export const maskPhone = (phone: string): string => {
  const digits = sanitizePhone(phone);
  if (digits.length < 4) {
    return phone;
  }

  const visibleDigits = digits.slice(-4);
  const maskedDigits = "*".repeat(digits.length - 4);
  return maskedDigits + visibleDigits;
};

// ==================== VALIDATION UTILITIES ====================

export const validateInput = (
  input: string,
  maxLength: number = 255
): string => {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, ""); // Remove event handlers
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// ==================== LOGGING UTILITIES ====================

export const logAuthEvent = (
  event: string,
  userId?: string,
  metadata?: any
): void => {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    userId: userId || "anonymous",
    metadata: metadata || {},
  };

  console.log("Auth Event:", JSON.stringify(logData));
};

export const logSecurityEvent = (
  event: string,
  ip: string,
  userAgent: string,
  metadata?: any
): void => {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    ip,
    userAgent,
    metadata: metadata || {},
  };

  console.warn("Security Event:", JSON.stringify(logData));
};

// ==================== CONFIG UTILITIES ====================

export const getAuthConfig = () => {
  return {
    jwtSecret: process.env.JWT_SECRET,
    tokenExpiry: process.env.JWT_EXPIRY || "7d",
    resetTokenExpiry: process.env.RESET_TOKEN_EXPIRY || "15m",
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12"),
    emailVerificationExpiry: parseInt(
      process.env.EMAIL_VERIFICATION_EXPIRY || "86400000"
    ), // 24 hours
    passwordResetExpiry: parseInt(
      process.env.PASSWORD_RESET_EXPIRY || "900000"
    ), // 15 minutes
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5"),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || "900000"), // 15 minutes
  };
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === "development";
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === "production";
};
