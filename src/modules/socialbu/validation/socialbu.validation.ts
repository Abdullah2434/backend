import { Request, Response, NextFunction } from "express";
import { body, param, query, validationResult } from "express-validator";
import {
  SocialBuResponse,
  SocialBuError,
  ValidationError,
} from "../types/socialbu.types";

// ==================== VALIDATION MIDDLEWARE ====================

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.type === "field" ? (error as any).path : "unknown",
      message: error.msg,
      value: error.type === "field" ? (error as any).value : undefined,
    }));

    const response: SocialBuResponse = {
      success: false,
      message: "Validation failed",
      error: errorMessages.map((e) => e.message).join(", "),
    };

    res.status(400).json(response);
    return;
  }

  next();
};

// ==================== AUTHENTICATION VALIDATION ====================

export const validateLoginRequest = [
  body("email")
    .optional()
    .isEmail()
    .withMessage("Email must be a valid email address")
    .normalizeEmail(),
  body("password")
    .optional()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  handleValidationErrors,
];

export const validateSaveTokenRequest = [
  body("authToken")
    .notEmpty()
    .withMessage("Auth token is required")
    .isLength({ min: 10 })
    .withMessage("Auth token must be at least 10 characters long"),
  body("id")
    .notEmpty()
    .withMessage("User ID is required")
    .isLength({ min: 1 })
    .withMessage("User ID cannot be empty"),
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .trim(),
  body("email")
    .isEmail()
    .withMessage("Email must be a valid email address")
    .normalizeEmail(),
  body("verified")
    .optional()
    .isBoolean()
    .withMessage("Verified must be a boolean value"),
  handleValidationErrors,
];

// ==================== ACCOUNT VALIDATION ====================

export const validateAccountRequest = [
  body("accountId")
    .notEmpty()
    .withMessage("Account ID is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Account ID must be between 1 and 100 characters")
    .trim(),
  body("accountName")
    .notEmpty()
    .withMessage("Account name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Account name must be between 2 and 100 characters")
    .trim(),
  body("platform")
    .notEmpty()
    .withMessage("Platform is required")
    .isIn(["youtube", "tiktok", "instagram", "facebook", "twitter", "linkedin"])
    .withMessage(
      "Platform must be one of: youtube, tiktok, instagram, facebook, twitter, linkedin"
    ),
  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
  handleValidationErrors,
];

export const validateAccountId = [
  param("accountId")
    .notEmpty()
    .withMessage("Account ID is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Account ID must be between 1 and 100 characters"),
  handleValidationErrors,
];

export const validateAccountQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("platform")
    .optional()
    .isIn(["youtube", "tiktok", "instagram", "facebook", "twitter", "linkedin"])
    .withMessage(
      "Platform must be one of: youtube, tiktok, instagram, facebook, twitter, linkedin"
    ),
  query("status")
    .optional()
    .isIn(["active", "inactive", "pending", "suspended"])
    .withMessage("Status must be one of: active, inactive, pending, suspended"),
  handleValidationErrors,
];

// ==================== MEDIA VALIDATION ====================

export const validateMediaRequest = [
  body("name")
    .notEmpty()
    .withMessage("Media name is required")
    .isLength({ min: 2, max: 255 })
    .withMessage("Media name must be between 2 and 255 characters")
    .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
    .withMessage(
      "Media name can only contain letters, numbers, spaces, hyphens, underscores, and dots"
    )
    .trim(),
  body("mime_type")
    .notEmpty()
    .withMessage("MIME type is required")
    .isIn([
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
    ])
    .withMessage("MIME type must be a supported video or image format"),
  body("videoUrl")
    .notEmpty()
    .withMessage("Video URL is required")
    .isURL()
    .withMessage("Video URL must be a valid URL"),
  handleValidationErrors,
];

export const validateMediaId = [
  param("mediaId")
    .notEmpty()
    .withMessage("Media ID is required")
    .isMongoId()
    .withMessage("Media ID must be a valid MongoDB ObjectId"),
  handleValidationErrors,
];

export const validateMediaQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("status")
    .optional()
    .isIn([
      "pending",
      "api_completed",
      "script_executing",
      "script_completed",
      "failed",
    ])
    .withMessage(
      "Status must be one of: pending, api_completed, script_executing, script_completed, failed"
    ),
  query("mime_type")
    .optional()
    .isIn([
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
    ])
    .withMessage("MIME type must be a supported format"),
  handleValidationErrors,
];

// ==================== WEBHOOK VALIDATION ====================

export const validateWebhookRequest = [
  body("account_id")
    .notEmpty()
    .withMessage("Account ID is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Account ID must be between 1 and 100 characters"),
  body("user_id")
    .notEmpty()
    .withMessage("User ID is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("User ID must be between 1 and 100 characters"),
  body("platform")
    .notEmpty()
    .withMessage("Platform is required")
    .isIn(["youtube", "tiktok", "instagram", "facebook", "twitter", "linkedin"])
    .withMessage(
      "Platform must be one of: youtube, tiktok, instagram, facebook, twitter, linkedin"
    ),
  body("account_name")
    .notEmpty()
    .withMessage("Account name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Account name must be between 2 and 100 characters"),
  body("event_type")
    .notEmpty()
    .withMessage("Event type is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Event type must be between 2 and 50 characters"),
  body("timestamp")
    .notEmpty()
    .withMessage("Timestamp is required")
    .isISO8601()
    .withMessage("Timestamp must be a valid ISO 8601 date"),
  body("data").optional().isObject().withMessage("Data must be an object"),
  handleValidationErrors,
];

// ==================== CUSTOM VALIDATORS ====================

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

export const sanitizeInput = (input: any): any => {
  if (typeof input === "string") {
    return input.trim().replace(/[<>]/g, "");
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (input && typeof input === "object") {
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }

  return input;
};

// ==================== ERROR HANDLING ====================

export const handleValidationError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof SocialBuError) {
    const response: SocialBuResponse = {
      success: false,
      message: error.message,
      error: error.code,
    };
    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof ValidationError) {
    const response: SocialBuResponse = {
      success: false,
      message: error.message,
      error: error.field
        ? `Validation error in ${error.field}`
        : "Validation error",
    };
    res.status(400).json(response);
    return;
  }

  const response: SocialBuResponse = {
    success: false,
    message: "Validation error",
    error: "UNKNOWN_ERROR",
  };
  res.status(400).json(response);
};
