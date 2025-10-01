import {
  body,
  param,
  query,
  ValidationChain,
  validationResult,
} from "express-validator";
import { Request, Response, NextFunction } from "express";
import { VideoResponse } from "../types/video.types";

// ==================== VALIDATION RULES ====================

// Video ID validation
const videoIdValidation = body("videoId")
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage("Video ID is required and must be less than 100 characters")
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage(
    "Video ID can only contain letters, numbers, underscores, and hyphens"
  );

// Title validation
const titleValidation = body("title")
  .trim()
  .isLength({ min: 1, max: 200 })
  .withMessage("Title must be between 1 and 200 characters")
  .matches(
    /^[a-zA-Z0-9\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]+$/
  )
  .withMessage("Title contains invalid characters")
  .customSanitizer((value) => sanitizeTitle(value));

// Email validation
const emailValidation = body("email")
  .isEmail()
  .withMessage("Please provide a valid email address")
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage("Email must be less than 255 characters")
  .customSanitizer((value) => sanitizeEmail(value));

// Execution ID validation
const executionIdValidation = body("executionId")
  .optional()
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage("Execution ID must be less than 100 characters")
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage(
    "Execution ID can only contain letters, numbers, underscores, and hyphens"
  );

// Video URL validation
const videoUrlValidation = body("videoUrl")
  .isURL()
  .withMessage("Please provide a valid video URL")
  .customSanitizer((value) => sanitizeUrl(value));

// Status validation
const statusValidation = body("status")
  .isIn(["processing", "ready", "failed"])
  .withMessage("Status must be one of: processing, ready, failed");

// User ID validation
const userIdValidation = param("userId")
  .isMongoId()
  .withMessage("Invalid user ID format");

// Topic validation
const topicValidation = param("topic")
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage("Topic must be between 1 and 100 characters")
  .matches(/^[a-zA-Z0-9\s_-]+$/)
  .withMessage(
    "Topic can only contain letters, numbers, spaces, underscores, and hyphens"
  );

// ID validation
const idValidation = param("id").isMongoId().withMessage("Invalid ID format");

// URL query validation
const urlQueryValidation = query("url")
  .isURL()
  .withMessage("Please provide a valid URL");

// Video creation validation
const videoCreationValidation = [
  body("prompt")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Prompt must be between 10 and 1000 characters"),
  body("avatar")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Avatar is required and must be less than 100 characters"),
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),
  body("position")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Position must be between 1 and 100 characters"),
  body("companyName")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Company name must be between 1 and 100 characters"),
  body("license")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("License must be between 1 and 100 characters"),
  body("tailoredFit")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Tailored fit must be between 1 and 100 characters"),
  body("socialHandles")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Social handles must be between 1 and 200 characters"),
  body("videoTopic")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Video topic must be between 1 and 100 characters"),
  body("topicKeyPoints")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Topic key points must be between 10 and 1000 characters"),
  body("city")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("City must be between 1 and 100 characters"),
  body("preferredTone")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Preferred tone must be between 1 and 100 characters"),
  body("callToAction")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Call to action must be between 1 and 200 characters"),
  emailValidation,
];

// Video generation validation
const videoGenerationValidation = [
  body("hook")
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Hook must be between 10 and 500 characters"),
  body("body")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Body must be between 10 and 2000 characters"),
  body("conclusion")
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Conclusion must be between 10 and 500 characters"),
  body("company_name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Company name must be between 1 and 100 characters"),
  body("social_handles")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Social handles must be between 1 and 200 characters"),
  body("license")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("License must be between 1 and 100 characters"),
  body("avatar_title")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Avatar title must be between 1 and 100 characters"),
  body("avatar_body")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Avatar body must be between 10 and 1000 characters"),
  body("avatar_conclusion")
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Avatar conclusion must be between 10 and 500 characters"),
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),
  emailValidation,
];

// Photo avatar validation
const photoAvatarValidation = [
  body("age_group")
    .trim()
    .isIn(["child", "teen", "adult", "senior"])
    .withMessage("Age group must be one of: child, teen, adult, senior"),
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),
  body("gender")
    .trim()
    .isIn(["male", "female", "other"])
    .withMessage("Gender must be one of: male, female, other"),
  body("userId").isMongoId().withMessage("Invalid user ID format"),
  body("ethnicity")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Ethnicity must be less than 50 characters"),
];

// Track execution validation
const trackExecutionValidation = [
  body("executionId")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage(
      "Execution ID is required and must be less than 100 characters"
    ),
  emailValidation,
];

// ==================== VALIDATION CHAINS ====================

export const validateVideoDelete: ValidationChain[] = [videoIdValidation];

export const validateVideoDownload: ValidationChain[] = [
  videoUrlValidation,
  titleValidation,
  emailValidation,
  executionIdValidation,
];

export const validateVideoStatus: ValidationChain[] = [
  videoIdValidation,
  statusValidation,
];

export const validateVideoCreate: ValidationChain[] = videoCreationValidation;

export const validateVideoGenerate: ValidationChain[] =
  videoGenerationValidation;

export const validateVideoDownloadProxy: ValidationChain[] = [
  urlQueryValidation,
];

export const validatePhotoAvatar: ValidationChain[] = photoAvatarValidation;

export const validatePendingWorkflows: ValidationChain[] = [userIdValidation];

export const validateTrackExecution: ValidationChain[] =
  trackExecutionValidation;

export const validateTopicByType: ValidationChain[] = [topicValidation];

export const validateTopicById: ValidationChain[] = [idValidation];

// ==================== VALIDATION MIDDLEWARE ====================

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.type === "field" ? (error as any).path : "unknown",
      message: error.msg,
      value: error.type === "field" ? (error as any).value : undefined,
    }));

    const response: VideoResponse = {
      success: false,
      message: "Validation failed",
      data: { errors: formattedErrors },
    };

    res.status(400).json(response);
    return;
  }

  next();
};

// ==================== SANITIZATION FUNCTIONS ====================

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

// ==================== CUSTOM VALIDATORS ====================

export const validateVideoId = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

export const validateTitle = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 200) return false;
  return /^[a-zA-Z0-9\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]+$/.test(
    trimmed
  );
};

export const validateEmail = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) && value.length <= 255;
};

export const validateExecutionId = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

export const validateVideoUrl = (value: string): boolean => {
  if (!value || typeof value !== "string") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const validateStatus = (value: string): boolean => {
  return ["processing", "ready", "failed"].includes(value);
};

// ==================== VALIDATION UTILITIES ====================

export const validateVideoData = (
  data: any
): {
  isValid: boolean;
  errors: Array<{ field: string; message: string; value?: any }>;
} => {
  const errors: Array<{ field: string; message: string; value?: any }> = [];

  if (data.videoId && !validateVideoId(data.videoId)) {
    errors.push({
      field: "videoId",
      message:
        "Video ID must be between 1 and 100 characters and contain only valid characters",
      value: data.videoId,
    });
  }

  if (data.title && !validateTitle(data.title)) {
    errors.push({
      field: "title",
      message:
        "Title must be between 1 and 200 characters and contain only valid characters",
      value: data.title,
    });
  }

  if (data.email && !validateEmail(data.email)) {
    errors.push({
      field: "email",
      message: "Please provide a valid email address",
      value: data.email,
    });
  }

  if (data.executionId && !validateExecutionId(data.executionId)) {
    errors.push({
      field: "executionId",
      message:
        "Execution ID must be between 1 and 100 characters and contain only valid characters",
      value: data.executionId,
    });
  }

  if (data.videoUrl && !validateVideoUrl(data.videoUrl)) {
    errors.push({
      field: "videoUrl",
      message: "Please provide a valid video URL",
      value: data.videoUrl,
    });
  }

  if (data.status && !validateStatus(data.status)) {
    errors.push({
      field: "status",
      message: "Status must be one of: processing, ready, failed",
      value: data.status,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ==================== EXPORT ALL VALIDATION FUNCTIONS ====================

export {
  videoIdValidation,
  titleValidation,
  emailValidation,
  executionIdValidation,
  videoUrlValidation,
  statusValidation,
  userIdValidation,
  topicValidation,
  idValidation,
  urlQueryValidation,
  videoCreationValidation,
  videoGenerationValidation,
  photoAvatarValidation,
  trackExecutionValidation,
};
