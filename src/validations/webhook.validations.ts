import { z } from "zod";
import { ValidationError } from "../types";
import {
  VALID_AVATAR_STATUSES,
  VALID_VIDEO_STATUSES,
} from "../constants/webhook.constants";

// ==================== VALIDATION SCHEMAS ====================

export const avatarWebhookSchema = z.object({
  avatar_id: z.string().min(1, "Avatar ID is required"),
  status: z.enum(VALID_AVATAR_STATUSES, {
    errorMap: () => ({
      message: 'Invalid status. Must be "completed" or "failed"',
    }),
  }),
  avatar_group_id: z.string().min(1, "Avatar group ID is required"),
  callback_id: z.string().optional(),
  user_id: z.string().optional(),
  webhook_url: z.string().url("Webhook URL must be a valid URL").optional(),
});

export const testWebhookSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.string().optional(),
  s3Key: z.string().optional(),
  metadata: z.any().optional(),
  error: z.string().optional(),
  scheduleId: z.string().optional(),
  trendIndex: z.number().optional(),
  captions: z.any().optional(),
});

export const scheduledVideoCompleteSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.string().optional(),
  s3Key: z.string().optional(),
  metadata: z.any().optional(),
  error: z.string().optional(),
  scheduleId: z.string().min(1, "Schedule ID is required"),
  trendIndex: z.number().int("Trend index must be an integer").min(0, "Trend index must be non-negative"),
  captions: z.any().optional(),
});

export const verifyWebhookSchema = z.object({
  payload: z.any().refine((val) => val !== undefined && val !== null, {
    message: "Payload is required",
  }),
  signature: z.string().min(1, "Signature is required"),
});

export const captionCompleteSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.string().min(1, "Status is required"),
  email: z.string().email("Email must be a valid email address").optional(),
  title: z.string().optional(),
});

export const videoCompleteSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  status: z.string().optional(),
  s3Key: z.string().optional(),
  metadata: z.any().optional(),
  error: z.string().optional(),
  scheduleId: z.string().optional(),
  trendIndex: z.number().optional(),
  captions: z.any().optional(),
});

export const handleWorkflowErrorSchema = z.object({
  errorMessage: z.string().min(1, "Error message is required"),
  executionId: z.string().min(1, "Execution ID is required"),
  scheduleId: z.string().optional(),
  trendIndex: z.number().int("Trend index must be an integer").optional(),
});

// ==================== TYPE INFERENCES ====================

export type AvatarWebhookData = z.infer<typeof avatarWebhookSchema>;
export type TestWebhookData = z.infer<typeof testWebhookSchema>;
export type ScheduledVideoCompleteData = z.infer<
  typeof scheduledVideoCompleteSchema
>;
export type VerifyWebhookData = z.infer<typeof verifyWebhookSchema>;
export type CaptionCompleteData = z.infer<typeof captionCompleteSchema>;
export type VideoCompleteData = z.infer<typeof videoCompleteSchema>;
export type HandleWorkflowErrorData = z.infer<typeof handleWorkflowErrorSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface AvatarWebhookValidationResult {
  success: boolean;
  data?: AvatarWebhookData;
  errors?: ValidationError[];
}

export interface TestWebhookValidationResult {
  success: boolean;
  data?: TestWebhookData;
  errors?: ValidationError[];
}

export interface ScheduledVideoCompleteValidationResult {
  success: boolean;
  data?: ScheduledVideoCompleteData;
  errors?: ValidationError[];
}

export interface VerifyWebhookValidationResult {
  success: boolean;
  data?: VerifyWebhookData;
  errors?: ValidationError[];
}

export interface CaptionCompleteValidationResult {
  success: boolean;
  data?: CaptionCompleteData;
  errors?: ValidationError[];
}

export interface VideoCompleteValidationResult {
  success: boolean;
  data?: VideoCompleteData;
  errors?: ValidationError[];
}

export interface HandleWorkflowErrorValidationResult {
  success: boolean;
  data?: HandleWorkflowErrorData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate avatar webhook request data
 */
export function validateAvatarWebhook(
  data: unknown
): AvatarWebhookValidationResult {
  const validationResult = avatarWebhookSchema.safeParse(data);

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
 * Validate test webhook request data
 */
export function validateTestWebhook(
  data: unknown
): TestWebhookValidationResult {
  const validationResult = testWebhookSchema.safeParse(data);

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
 * Validate scheduled video complete webhook request data
 */
export function validateScheduledVideoComplete(
  data: unknown
): ScheduledVideoCompleteValidationResult {
  const validationResult = scheduledVideoCompleteSchema.safeParse(data);

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
 * Validate verify webhook request data
 */
export function validateVerifyWebhook(
  data: unknown
): VerifyWebhookValidationResult {
  const validationResult = verifyWebhookSchema.safeParse(data);

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
 * Validate caption complete webhook request data
 */
export function validateCaptionComplete(
  data: unknown
): CaptionCompleteValidationResult {
  const validationResult = captionCompleteSchema.safeParse(data);

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
 * Validate video complete webhook request data
 */
export function validateVideoComplete(
  data: unknown
): VideoCompleteValidationResult {
  const validationResult = videoCompleteSchema.safeParse(data);

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
 * Validate handle workflow error webhook request data
 */
export function validateHandleWorkflowError(
  data: unknown
): HandleWorkflowErrorValidationResult {
  const validationResult = handleWorkflowErrorSchema.safeParse(data);

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


