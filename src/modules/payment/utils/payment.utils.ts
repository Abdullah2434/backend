import * as crypto from "crypto";

// ==================== PAYMENT UTILITIES ====================

export const generatePaymentId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `pay_${timestamp}_${random}`;
};

export const generateSetupIntentId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `seti_${timestamp}_${random}`;
};

export const generateCustomerId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `cus_${timestamp}_${random}`;
};

// ==================== VALIDATION UTILITIES ====================

export const isValidPaymentMethodId = (paymentMethodId: string): boolean => {
  if (!paymentMethodId || typeof paymentMethodId !== "string") return false;
  const trimmed = paymentMethodId.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^pm_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const isValidSetupIntentId = (setupIntentId: string): boolean => {
  if (!setupIntentId || typeof setupIntentId !== "string") return false;
  const trimmed = setupIntentId.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^seti_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const isValidCustomerId = (customerId: string): boolean => {
  if (!customerId || typeof customerId !== "string") return false;
  const trimmed = customerId.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^cus_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const isValidReturnUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

// ==================== SANITIZATION UTILITIES ====================

export const sanitizeUrl = (url: string): string => {
  return url.trim();
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const sanitizeString = (str: string): string => {
  return str
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

export const formatCardNumber = (last4: string): string => {
  return `**** **** **** ${last4}`;
};

export const formatExpiryDate = (month: number, year: number): string => {
  return `${month.toString().padStart(2, "0")}/${year.toString().slice(-2)}`;
};

export const formatCardBrand = (brand: string): string => {
  return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
};

export const formatAmount = (
  amount: number,
  currency: string = "usd"
): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

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

export const maskPaymentMethodId = (paymentMethodId: string): string => {
  if (paymentMethodId.length <= 8) return paymentMethodId;
  return (
    paymentMethodId.slice(0, 4) +
    "*".repeat(paymentMethodId.length - 8) +
    paymentMethodId.slice(-4)
  );
};

export const maskCardNumber = (cardNumber: string): string => {
  if (cardNumber.length <= 8) return cardNumber;
  return (
    cardNumber.slice(0, 4) +
    "*".repeat(cardNumber.length - 8) +
    cardNumber.slice(-4)
  );
};

// ==================== LOGGING UTILITIES ====================

export const logPaymentEvent = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeInput(data),
  };
  console.log("💳 Payment Event:", JSON.stringify(logData, null, 2));
};

export const logPaymentError = (error: Error, context?: any): void => {
  const logData = {
    error: error.message,
    stack: error.stack,
    context: sanitizeInput(context),
    timestamp: new Date().toISOString(),
  };
  console.error("💳 Payment Error:", JSON.stringify(logData, null, 2));
};

export const logPaymentSecurity = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeInput(data),
    severity: "security",
  };
  console.warn("🔒 Payment Security:", JSON.stringify(logData, null, 2));
};

// ==================== CONFIGURATION UTILITIES ====================

export const getPaymentConfig = () => {
  return {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    apiVersion: "2023-10-16",
    currency: "usd",
    returnUrl: process.env.PAYMENT_RETURN_URL || "https://www.edgeairealty.com",
    rateLimitWindow: parseInt(
      process.env.PAYMENT_RATE_LIMIT_WINDOW || "900000"
    ), // 15 minutes
    rateLimitMax: parseInt(process.env.PAYMENT_RATE_LIMIT_MAX || "10"),
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

// ==================== PAYMENT SPECIFIC UTILITIES ====================

export const extractPaymentMethodIdFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split("/");
    return segments[segments.length - 1] || null;
  } catch {
    return null;
  }
};

export const isValidCardBrand = (brand: string): boolean => {
  const validBrands = [
    "visa",
    "mastercard",
    "amex",
    "discover",
    "diners",
    "jcb",
    "unionpay",
  ];
  return validBrands.includes(brand.toLowerCase());
};

export const isValidExpiryMonth = (month: number): boolean => {
  return month >= 1 && month <= 12;
};

export const isValidExpiryYear = (year: number): boolean => {
  const currentYear = new Date().getFullYear();
  return year >= currentYear && year <= currentYear + 20;
};

export const isCardExpired = (month: number, year: number): boolean => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return true;
  if (year === currentYear && month < currentMonth) return true;
  return false;
};

export const calculateCardHash = async (cardData: any): Promise<string> => {
  const cardString = JSON.stringify(cardData);
  return crypto.createHash("sha256").update(cardString).digest("hex");
};

export const generatePaymentMetadata = (paymentData: any): any => {
  return {
    userId: paymentData.userId,
    timestamp: new Date().toISOString(),
    source: "web",
    version: "1.0.0",
  };
};
