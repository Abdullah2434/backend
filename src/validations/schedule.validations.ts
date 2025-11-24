import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Edit schedule post validation schema
 */
export const editSchedulePostSchema = z.object({
  description: z.string().optional(),
  keypoints: z.string().optional(),
  scheduledFor: z.union([z.string(), z.date()]).optional(),
  captions: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional(),
    })
    .optional(),
}).refine(
  (data) => {
    // At least one field must be provided
    return (
      data.description !== undefined ||
      data.keypoints !== undefined ||
      data.scheduledFor !== undefined ||
      data.captions !== undefined
    );
  },
  {
    message: "At least one field must be provided for update",
  }
);

/**
 * Schedule post ID route parameter schema
 */
export const schedulePostIdSchema = z.object({
  postId: z
    .string()
    .min(1, "Post ID is required")
    .refine(
      (val) => val.includes("_"),
      "Invalid post ID format. Expected format: scheduleId_index"
    ),
});

/**
 * Schedule ID route parameter schema
 */
export const scheduleIdSchema = z.object({
  scheduleId: z.string().min(1, "Schedule ID is required"),
});

// ==================== TYPE INFERENCES ====================

export type EditSchedulePostData = z.infer<typeof editSchedulePostSchema>;
export type SchedulePostIdData = z.infer<typeof schedulePostIdSchema>;
export type ScheduleIdData = z.infer<typeof scheduleIdSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface EditSchedulePostValidationResult {
  success: boolean;
  data?: EditSchedulePostData;
  errors?: ValidationError[];
}

export interface SchedulePostIdValidationResult {
  success: boolean;
  data?: SchedulePostIdData;
  errors?: ValidationError[];
}

export interface ScheduleIdValidationResult {
  success: boolean;
  data?: ScheduleIdData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate edit schedule post request data
 */
export function validateEditSchedulePost(
  data: unknown
): EditSchedulePostValidationResult {
  const validationResult = editSchedulePostSchema.safeParse(data);

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
 * Validate schedule post ID route parameter
 */
export function validateSchedulePostId(
  data: unknown
): SchedulePostIdValidationResult {
  const validationResult = schedulePostIdSchema.safeParse(data);

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
 * Validate schedule ID route parameter
 */
export function validateScheduleId(
  data: unknown
): ScheduleIdValidationResult {
  const validationResult = scheduleIdSchema.safeParse(data);

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

