import * as crypto from "crypto";

// ==================== VIDEO UTILITIES ====================

export const generateVideoId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `video_${timestamp}_${random}`;
};

export const generateExecutionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `exec_${timestamp}_${random}`;
};

export const generateRequestId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `req_${timestamp}_${random}`;
};

// ==================== VALIDATION UTILITIES ====================

export const isValidVideoId = (videoId: string): boolean => {
  if (!videoId || typeof videoId !== "string") return false;
  const trimmed = videoId.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

export const isValidTitle = (title: string): boolean => {
  if (!title || typeof title !== "string") return false;
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 200) return false;
  return /^[a-zA-Z0-9\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]+$/.test(
    trimmed
  );
};

export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

export const isValidExecutionId = (executionId: string): boolean => {
  if (!executionId || typeof executionId !== "string") return false;
  const trimmed = executionId.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

export const isValidVideoUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidStatus = (status: string): boolean => {
  return ["processing", "ready", "failed"].includes(status);
};

export const isValidMongoId = (id: string): boolean => {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// ==================== SANITIZATION UTILITIES ====================

export const sanitizeTitle = (title: string): string => {
  return title
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /[^\w\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]/g,
      ""
    );
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const sanitizeUrl = (url: string): string => {
  return url.trim();
};

export const sanitizeText = (text: string): string => {
  return text
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

export const formatVideoTitle = (title: string): string => {
  return title
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const formatVideoStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
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

export const maskVideoId = (videoId: string): string => {
  if (videoId.length <= 8) return videoId;
  return (
    videoId.slice(0, 4) + "*".repeat(videoId.length - 8) + videoId.slice(-4)
  );
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

export const logVideoEvent = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeInput(data),
  };
  console.log("🎥 Video Event:", JSON.stringify(logData, null, 2));
};

export const logVideoError = (error: Error, context?: any): void => {
  const logData = {
    error: error.message,
    stack: error.stack,
    context: sanitizeInput(context),
    timestamp: new Date().toISOString(),
  };
  console.error("🎥 Video Error:", JSON.stringify(logData, null, 2));
};

export const logVideoSecurity = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeInput(data),
    severity: "security",
  };
  console.warn("🔒 Video Security:", JSON.stringify(logData, null, 2));
};

// ==================== CONFIGURATION UTILITIES ====================

export const getVideoConfig = () => {
  return {
    webhookUrl: process.env.VIDEO_CREATION_WEBHOOK_URL || "",
    generateWebhookUrl: process.env.GENERATE_VIDEO_WEBHOOK_URL || "",
    maxFileSize: parseInt(process.env.VIDEO_MAX_FILE_SIZE || "10485760"), // 10MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    rateLimitWindow: parseInt(process.env.VIDEO_RATE_LIMIT_WINDOW || "900000"), // 15 minutes
    rateLimitMax: parseInt(process.env.VIDEO_RATE_LIMIT_MAX || "10"),
    maxVideoSize: parseInt(process.env.VIDEO_MAX_VIDEO_SIZE || "104857600"), // 100MB
    maxTitleLength: parseInt(process.env.VIDEO_MAX_TITLE_LENGTH || "200"),
    maxPromptLength: parseInt(process.env.VIDEO_MAX_PROMPT_LENGTH || "1000"),
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

// ==================== VIDEO SPECIFIC UTILITIES ====================

export const extractVideoIdFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split("/");
    return segments[segments.length - 1] || null;
  } catch {
    return null;
  }
};

export const isValidVideoMimeType = (mimeType: string): boolean => {
  const validTypes = [
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
  ];
  return validTypes.includes(mimeType);
};

export const isValidImageMimeType = (mimeType: string): boolean => {
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/svg+xml",
  ];
  return validTypes.includes(mimeType);
};

export const getVideoThumbnail = (videoUrl: string): string => {
  // This would typically generate a thumbnail URL
  // For now, return a placeholder
  return videoUrl.replace(/\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i, "_thumb.jpg");
};

export const calculateVideoHash = async (
  fileBuffer: Buffer
): Promise<string> => {
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
};

export const generateVideoMetadata = (file: any): any => {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    hash: "", // Would be calculated from file buffer
  };
};
