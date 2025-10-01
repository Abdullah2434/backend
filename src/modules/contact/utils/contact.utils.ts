import * as crypto from "crypto";

// ==================== CONTACT UTILITIES ====================

export const generateSubmissionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `contact_${timestamp}_${random}`;
};

export const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `req_${timestamp}_${random}`;
};

// ==================== VALIDATION UTILITIES ====================

export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

export const isValidPhone = (phone: string): boolean => {
  if (!phone || typeof phone !== "string") return false;
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
};

export const isValidName = (name: string): boolean => {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-Z\s'-]+$/.test(trimmed);
};

export const isValidPosition = (position: string): boolean => {
  if (!position || typeof position !== "string") return false;
  const trimmed = position.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9\s&.,-]+$/.test(trimmed);
};

export const isValidQuestion = (question: string): boolean => {
  if (!question || typeof question !== "string") return false;
  const trimmed = question.trim();
  if (trimmed.length < 10 || trimmed.length > 2000) return false;
  return /^[a-zA-Z0-9\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]+$/.test(
    trimmed
  );
};

// ==================== SANITIZATION UTILITIES ====================

export const sanitizeName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z\s'-]/g, "")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const sanitizePosition = (position: string): string => {
  return position
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9\s&.,-]/g, "");
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const sanitizePhone = (phone: string): string => {
  return phone.replace(/\D/g, "");
};

export const sanitizeQuestion = (question: string): string => {
  return question
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /[^\w\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]/g,
      ""
    );
};

export const sanitizeInput = (input: any): any => {
  if (typeof input === "string") {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim();
  } else if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  } else if (input && typeof input === "object") {
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
};

// ==================== FORMATTING UTILITIES ====================

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
      6
    )}`;
  } else if (cleaned.length === 11 && cleaned[0] === "1") {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(
      7
    )}`;
  }
  return phone;
};

export const formatName = (name: string): string => {
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const formatQuestion = (question: string): string => {
  return question
    .trim()
    .replace(/\s+/g, " ")
    .replace(/([.!?])\s*([a-zA-Z])/g, "$1 $2");
};

// ==================== MASKING UTILITIES ====================

export const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) return email;
  const maskedLocal =
    localPart[0] +
    "*".repeat(localPart.length - 2) +
    localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
};

export const maskPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length >= 4) {
    return "*".repeat(cleaned.length - 4) + cleaned.slice(-4);
  }
  return "*".repeat(cleaned.length);
};

// ==================== DATE UTILITIES ====================

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const formatDateReadable = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
};

// ==================== LOGGING UTILITIES ====================

export const logContactEvent = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeInput(data),
  };
  console.log("📧 Contact Event:", JSON.stringify(logData, null, 2));
};

export const logContactError = (error: Error, context?: any): void => {
  const logData = {
    error: error.message,
    stack: error.stack,
    context: sanitizeInput(context),
    timestamp: new Date().toISOString(),
  };
  console.error("📧 Contact Error:", JSON.stringify(logData, null, 2));
};

export const logContactSecurity = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeInput(data),
    severity: "security",
  };
  console.warn("🔒 Contact Security:", JSON.stringify(logData, null, 2));
};

// ==================== CONFIGURATION UTILITIES ====================

export const getContactConfig = () => {
  return {
    adminEmail:
      process.env.CONTACT_EMAIL ||
      process.env.ADMIN_EMAIL ||
      "hrehman@techtiz.co",
    contactEmail: process.env.CONTACT_EMAIL || "contact@edgeairealty.com",
    frontendUrl: process.env.FRONTEND_URL || "https://www.edgeairealty.com",
    rateLimitWindow: parseInt(
      process.env.CONTACT_RATE_LIMIT_WINDOW || "900000"
    ), // 15 minutes
    rateLimitMax: parseInt(process.env.CONTACT_RATE_LIMIT_MAX || "3"),
    maxQuestionLength: parseInt(
      process.env.CONTACT_MAX_QUESTION_LENGTH || "2000"
    ),
    maxNameLength: parseInt(process.env.CONTACT_MAX_NAME_LENGTH || "100"),
    maxPositionLength: parseInt(
      process.env.CONTACT_MAX_POSITION_LENGTH || "100"
    ),
    maxPhoneLength: parseInt(process.env.CONTACT_MAX_PHONE_LENGTH || "20"),
  };
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === "development";
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === "production";
};

// ==================== VALIDATION UTILITIES ====================

export const validateInput = (
  input: any,
  rules: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = input[field];
    const fieldRule = rule as any;

    if (fieldRule.required && (!value || value.toString().trim() === "")) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value && fieldRule.minLength && value.length < fieldRule.minLength) {
      errors.push(
        `${field} must be at least ${fieldRule.minLength} characters`
      );
    }

    if (value && fieldRule.maxLength && value.length > fieldRule.maxLength) {
      errors.push(
        `${field} must be less than ${fieldRule.maxLength} characters`
      );
    }

    if (value && fieldRule.pattern && !fieldRule.pattern.test(value)) {
      errors.push(`${field} format is invalid`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
