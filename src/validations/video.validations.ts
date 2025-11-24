import { z } from "zod";
import { ValidationError } from "../types";
import {
  VALID_VIDEO_STATUSES,
  VALID_ENERGY_LEVELS,
} from "../constants/video.constants";

// ==================== VALIDATION SCHEMAS ====================

export const videoIdParamSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
});

export const updateVideoNoteSchema = z.object({
  note: z.string().nullable().optional(),
});

export const updateVideoStatusSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.enum(VALID_VIDEO_STATUSES, {
    errorMap: () => ({
      message: "Invalid status. Must be processing, ready, or failed",
    }),
  }),
  metadata: z.any().optional(),
});

export const deleteVideoSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
});

export const trackExecutionSchema = z.object({
  executionId: z.string().min(1, "Execution ID is required"),
  email: z.string().email("Email must be a valid email address"),
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const downloadVideoSchema = z.object({
  videoUrl: z.string().url("Video URL must be a valid URL"),
  email: z.string().email("Email must be a valid email address"),
  title: z.string().min(1, "Title is required"),
  executionId: z.string().optional(),
  scheduleId: z.string().optional(),
  trendIndex: z.number().optional(),
  captions: z.any().optional(),
});

export const downloadProxyQuerySchema = z.object({
  url: z.string().url("Video URL is required"),
  token: z.string().optional(),
});

export const createPhotoAvatarSchema = z.object({
  age_group: z.string().min(1, "Age group is required"),
  name: z.string().min(1, "Name is required"),
  gender: z.string().min(1, "Gender is required"),
  userId: z.string().min(1, "User ID is required"),
  ethnicity: z.string().optional(),
});

export const createVideoSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  avatar: z.string().min(1, "Avatar is required"),
  name: z.string().min(1, "Name is required"),
  position: z.string().min(1, "Position is required"),
  companyName: z.string().min(1, "Company name is required"),
  license: z.string().min(1, "License is required"),
  tailoredFit: z.string().min(1, "Tailored fit is required"),
  socialHandles: z.string().min(1, "Social handles is required"),
  videoTopic: z.string().min(1, "Video topic is required"),
  topicKeyPoints: z.string().min(1, "Topic key points is required"),
  city: z.string().min(1, "City is required"),
  preferredTone: z.string().min(1, "Preferred tone is required"),
  callToAction: z.string().min(1, "Call to action is required"),
  email: z.string().email("Email must be a valid email address"),
  zipCode: z.string().optional(),
  zipKeyPoints: z.string().optional(),
  language: z.string().optional(),
});

export const generateVideoSchema = z.object({
  hook: z.string().min(1, "Hook is required"),
  body: z.string().min(1, "Body is required"),
  conclusion: z.string().min(1, "Conclusion is required"),
  company_name: z.string().min(1, "Company name is required"),
  social_handles: z.string().min(1, "Social handles is required"),
  license: z.string().min(1, "License is required"),
  avatar_title: z.string().min(1, "Avatar title is required"),
  avatar_body: z.string().min(1, "Avatar body is required"),
  avatar_conclusion: z.string().min(1, "Avatar conclusion is required"),
  email: z.string().email("Email must be a valid email address"),
  title: z.string().min(1, "Title is required"),
  energyLevel: z.enum(VALID_ENERGY_LEVELS).optional(),
  customVoiceEnergy: z.enum(VALID_ENERGY_LEVELS).optional(),
  music: z.string().optional(),
  scheduleId: z.string().optional(),
  trendIndex: z.number().optional(),
  language: z.string().optional(),
  text: z.string().optional(),
});

export const topicParamSchema = z.object({
  topic: z.string().min(1, "Topic parameter is required"),
});

export const topicIdParamSchema = z.object({
  id: z.string().min(1, "ID parameter is required"),
});

// ==================== TYPE INFERENCES ====================

export type VideoIdParamData = z.infer<typeof videoIdParamSchema>;
export type UpdateVideoNoteData = z.infer<typeof updateVideoNoteSchema>;
export type UpdateVideoStatusData = z.infer<typeof updateVideoStatusSchema>;
export type DeleteVideoData = z.infer<typeof deleteVideoSchema>;
export type TrackExecutionData = z.infer<typeof trackExecutionSchema>;
export type UserIdParamData = z.infer<typeof userIdParamSchema>;
export type DownloadVideoData = z.infer<typeof downloadVideoSchema>;
export type DownloadProxyQueryData = z.infer<typeof downloadProxyQuerySchema>;
export type CreatePhotoAvatarData = z.infer<typeof createPhotoAvatarSchema>;
export type CreateVideoData = z.infer<typeof createVideoSchema>;
export type GenerateVideoData = z.infer<typeof generateVideoSchema>;
export type TopicParamData = z.infer<typeof topicParamSchema>;
export type TopicIdParamData = z.infer<typeof topicIdParamSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface VideoIdParamValidationResult {
  success: boolean;
  data?: VideoIdParamData;
  errors?: ValidationError[];
}

export interface UpdateVideoNoteValidationResult {
  success: boolean;
  data?: UpdateVideoNoteData;
  errors?: ValidationError[];
}

export interface UpdateVideoStatusValidationResult {
  success: boolean;
  data?: UpdateVideoStatusData;
  errors?: ValidationError[];
}

export interface DeleteVideoValidationResult {
  success: boolean;
  data?: DeleteVideoData;
  errors?: ValidationError[];
}

export interface TrackExecutionValidationResult {
  success: boolean;
  data?: TrackExecutionData;
  errors?: ValidationError[];
}

export interface UserIdParamValidationResult {
  success: boolean;
  data?: UserIdParamData;
  errors?: ValidationError[];
}

export interface DownloadVideoValidationResult {
  success: boolean;
  data?: DownloadVideoData;
  errors?: ValidationError[];
}

export interface DownloadProxyQueryValidationResult {
  success: boolean;
  data?: DownloadProxyQueryData;
  errors?: ValidationError[];
}

export interface CreatePhotoAvatarValidationResult {
  success: boolean;
  data?: CreatePhotoAvatarData;
  errors?: ValidationError[];
}

export interface CreateVideoValidationResult {
  success: boolean;
  data?: CreateVideoData;
  errors?: ValidationError[];
}

export interface GenerateVideoValidationResult {
  success: boolean;
  data?: GenerateVideoData;
  errors?: ValidationError[];
}

export interface TopicParamValidationResult {
  success: boolean;
  data?: TopicParamData;
  errors?: ValidationError[];
}

export interface TopicIdParamValidationResult {
  success: boolean;
  data?: TopicIdParamData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate video ID parameter
 */
export function validateVideoIdParam(
  data: unknown
): VideoIdParamValidationResult {
  const validationResult = videoIdParamSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate update video note request data
 */
export function validateUpdateVideoNote(
  data: unknown
): UpdateVideoNoteValidationResult {
  const validationResult = updateVideoNoteSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate update video status request data
 */
export function validateUpdateVideoStatus(
  data: unknown
): UpdateVideoStatusValidationResult {
  const validationResult = updateVideoStatusSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate delete video request data
 */
export function validateDeleteVideo(
  data: unknown
): DeleteVideoValidationResult {
  const validationResult = deleteVideoSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate track execution request data
 */
export function validateTrackExecution(
  data: unknown
): TrackExecutionValidationResult {
  const validationResult = trackExecutionSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate user ID parameter
 */
export function validateUserIdParam(
  data: unknown
): UserIdParamValidationResult {
  const validationResult = userIdParamSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate download video request data
 */
export function validateDownloadVideo(
  data: unknown
): DownloadVideoValidationResult {
  const validationResult = downloadVideoSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate download proxy query parameters
 */
export function validateDownloadProxyQuery(
  data: unknown
): DownloadProxyQueryValidationResult {
  const validationResult = downloadProxyQuerySchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate create photo avatar request data
 */
export function validateCreatePhotoAvatar(
  data: unknown
): CreatePhotoAvatarValidationResult {
  const validationResult = createPhotoAvatarSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate create video request data
 */
export function validateCreateVideo(
  data: unknown
): CreateVideoValidationResult {
  const validationResult = createVideoSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate generate video request data
 */
export function validateGenerateVideo(
  data: unknown
): GenerateVideoValidationResult {
  const validationResult = generateVideoSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate topic parameter
 */
export function validateTopicParam(
  data: unknown
): TopicParamValidationResult {
  const validationResult = topicParamSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

/**
 * Validate topic ID parameter
 */
export function validateTopicIdParam(
  data: unknown
): TopicIdParamValidationResult {
  const validationResult = topicIdParamSchema.safeParse(data);

  if (!validationResult.success) {
    const errors: ValidationError[] = validationResult.error.errors.map(
      (err) => ({
        field: err.path.join("."),
        message: err.message,
      })
    );

    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: validationResult.data,
  };
}

