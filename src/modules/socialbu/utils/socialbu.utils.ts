import * as crypto from "crypto";

// ==================== SOCIALBU UTILITIES ====================

export const generateSocialBuId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `sb_${timestamp}_${random}`;
};

export const generateMediaId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `media_${timestamp}_${random}`;
};

// ==================== VALIDATION UTILITIES ====================

export const isValidObjectId = (value: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

export const isValidMimeType = (mimeType: string): boolean => {
  const validTypes = [
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  return validTypes.includes(mimeType);
};

export const isValidPlatform = (platform: string): boolean => {
  const validPlatforms = [
    "youtube",
    "tiktok",
    "instagram",
    "facebook",
    "twitter",
    "linkedin",
  ];
  return validPlatforms.includes(platform);
};

export const isValidStatus = (
  status: string,
  type: "account" | "media"
): boolean => {
  if (type === "account") {
    return ["active", "inactive", "pending", "suspended"].includes(status);
  } else if (type === "media") {
    return [
      "pending",
      "api_completed",
      "script_executing",
      "script_completed",
      "failed",
    ].includes(status);
  }
  return false;
};

export const isValidAuthToken = (token: string): boolean => {
  return !!(token && token.length >= 10 && /^[a-zA-Z0-9\-_]+$/.test(token));
};

// ==================== SANITIZATION UTILITIES ====================

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, "").replace(/\s+/g, " ");
};

export const sanitizeObject = (obj: any): any => {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }

  return obj;
};

export const sanitizeMediaName = (name: string): string => {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s\-_\.]/g, "")
    .replace(/\s+/g, " ")
    .substring(0, 255);
};

// ==================== FORMATTING UTILITIES ====================

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

export const formatPlatformName = (platform: string): string => {
  const platformNames: Record<string, string> = {
    youtube: "YouTube",
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
    twitter: "Twitter",
    linkedin: "LinkedIn",
  };

  return platformNames[platform] || platform;
};

export const formatStatusName = (status: string): string => {
  const statusNames: Record<string, string> = {
    pending: "Pending",
    api_completed: "API Completed",
    script_executing: "Script Executing",
    script_completed: "Script Completed",
    failed: "Failed",
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
  };

  return statusNames[status] || status;
};

// ==================== MASKING UTILITIES ====================

export const maskAuthToken = (token: string): string => {
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

export const maskAccountId = (accountId: string): string => {
  if (accountId.length <= 8) return accountId;
  return `${accountId.slice(0, 4)}...${accountId.slice(-4)}`;
};

export const maskMediaId = (mediaId: string): string => {
  if (mediaId.length <= 8) return mediaId;
  return `${mediaId.slice(0, 4)}...${mediaId.slice(-4)}`;
};

// ==================== LOGGING UTILITIES ====================

export const logSocialBuEvent = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeObject(data),
  };
  console.log("📱 SocialBu Event:", JSON.stringify(logData, null, 2));
};

export const logSocialBuError = (error: Error, context?: any): void => {
  const logData = {
    error: error.message,
    stack: error.stack,
    context: sanitizeObject(context),
    timestamp: new Date().toISOString(),
  };
  console.error("📱 SocialBu Error:", JSON.stringify(logData, null, 2));
};

export const logSocialBuApiCall = (
  endpoint: string,
  method: string,
  data?: any
): void => {
  const logData = {
    endpoint,
    method,
    data: sanitizeObject(data),
    timestamp: new Date().toISOString(),
  };
  console.log("📱 SocialBu API Call:", JSON.stringify(logData, null, 2));
};

export const logSocialBuProcessing = (
  type: string,
  id: string,
  processingTime: number
): void => {
  const logData = {
    type,
    id: maskMediaId(id),
    processingTime: `${processingTime}ms`,
    timestamp: new Date().toISOString(),
  };
  console.log("⚡ SocialBu Processing:", JSON.stringify(logData, null, 2));
};

// ==================== CONFIGURATION UTILITIES ====================

export const getSocialBuConfig = () => {
  return {
    apiUrl: process.env.SOCIALBU_API_URL || "https://api.socialbu.com",
    apiKey: process.env.SOCIALBU_API_KEY || "",
    webhookSecret: process.env.SOCIALBU_WEBHOOK_SECRET || "",
    timeout: parseInt(process.env.SOCIALBU_TIMEOUT || "30000"), // 30 seconds
    retryAttempts: parseInt(process.env.SOCIALBU_RETRY_ATTEMPTS || "3"),
    retryDelay: parseInt(process.env.SOCIALBU_RETRY_DELAY || "1000"), // 1 second
    enableLogging: process.env.SOCIALBU_ENABLE_LOGGING === "true",
    enableWebhooks: process.env.SOCIALBU_ENABLE_WEBHOOKS === "true",
    rateLimitWindow: parseInt(
      process.env.SOCIALBU_RATE_LIMIT_WINDOW || "60000"
    ), // 1 minute
    rateLimitMax: parseInt(process.env.SOCIALBU_RATE_LIMIT_MAX || "100"),
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

    if (
      value &&
      fieldRule.allowedValues &&
      !fieldRule.allowedValues.includes(value)
    ) {
      errors.push(
        `${field} must be one of: ${fieldRule.allowedValues.join(", ")}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ==================== SOCIALBU SPECIFIC UTILITIES ====================

export const extractPlatformFromUrl = (url: string): string | null => {
  const urlPatterns: Record<string, RegExp> = {
    youtube: /youtube\.com|youtu\.be/,
    tiktok: /tiktok\.com/,
    instagram: /instagram\.com/,
    facebook: /facebook\.com/,
    twitter: /twitter\.com|t\.co/,
    linkedin: /linkedin\.com/,
  };

  for (const [platform, pattern] of Object.entries(urlPatterns)) {
    if (pattern.test(url)) {
      return platform;
    }
  }

  return null;
};

export const isRetryableError = (error: Error): boolean => {
  const retryableErrors = [
    "ECONNRESET",
    "ENOTFOUND",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "SocialBuError",
    "ApiError",
  ];

  return retryableErrors.some(
    (errorType) =>
      error.name.includes(errorType) || error.message.includes(errorType)
  );
};

export const calculateRetryDelay = (
  attempt: number,
  baseDelay: number = 1000
): number => {
  const maxDelay = 30000; // 30 seconds
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
};

export const shouldRetry = (
  attempt: number,
  maxRetries: number,
  error: Error
): boolean => {
  if (attempt >= maxRetries) return false;
  return isRetryableError(error);
};

export const generateSocialBuHash = async (data: any): Promise<string> => {
  const dataString = JSON.stringify(data);
  return crypto.createHash("sha256").update(dataString).digest("hex");
};

export const generateSocialBuMetadata = (data: any): any => {
  return {
    timestamp: new Date().toISOString(),
    source: "socialbu",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  };
};

export const formatSocialBuResponse = (
  success: boolean,
  message: string,
  data?: any
) => {
  return {
    success,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

export const getMediaPriority = (mimeType: string): number => {
  const priorities: Record<string, number> = {
    "video/mp4": 1,
    "video/webm": 2,
    "video/avi": 3,
    "video/mov": 4,
    "image/jpeg": 5,
    "image/png": 6,
    "image/gif": 7,
  };

  return priorities[mimeType] || 10;
};

export const isHighPriorityMedia = (mimeType: string): boolean => {
  return getMediaPriority(mimeType) <= 3;
};

export const formatMediaSummary = (media: any): string => {
  const { name, mime_type, status, createdAt } = media;
  const timestamp = new Date(createdAt).toISOString();
  return `${name} (${mime_type}) - ${formatStatusName(status)} at ${timestamp}`;
};

export const calculateProcessingStats = (
  mediaList: any[]
): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  successRate: number;
} => {
  const total = mediaList.length;
  const completed = mediaList.filter(
    (m) => m.status === "script_completed"
  ).length;
  const failed = mediaList.filter((m) => m.status === "failed").length;
  const pending = mediaList.filter((m) =>
    ["pending", "api_completed", "script_executing"].includes(m.status)
  ).length;
  const successRate = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    failed,
    pending,
    successRate: Math.round(successRate * 100) / 100,
  };
};

export const formatAccountSummary = (account: any): string => {
  const { accountName, platform, status, connectedAt } = account;
  const timestamp = new Date(connectedAt).toISOString();
  return `${accountName} (${formatPlatformName(platform)}) - ${formatStatusName(
    status
  )} at ${timestamp}`;
};

export const calculateAccountStats = (
  accounts: any[]
): {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  byPlatform: Record<string, number>;
} => {
  const total = accounts.length;
  const active = accounts.filter((a) => a.status === "active").length;
  const inactive = accounts.filter((a) => a.status === "inactive").length;
  const suspended = accounts.filter((a) => a.status === "suspended").length;

  const byPlatform: Record<string, number> = {};
  accounts.forEach((account) => {
    byPlatform[account.platform] = (byPlatform[account.platform] || 0) + 1;
  });

  return {
    total,
    active,
    inactive,
    suspended,
    byPlatform,
  };
};
