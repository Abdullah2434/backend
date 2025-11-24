import { z } from "zod";
import { ValidationError } from "../types";
import { DEFAULT_PLATFORMS } from "../constants/dynamicPostGeneration.constants";
import {
  scheduleIdParamSchema,
  ScheduleIdParamData,
  ScheduleIdParamValidationResult,
  validateScheduleIdParam,
} from "./videoSchedule.validations";

/**
 * Valid platform values
 */
export const VALID_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "tiktok",
  "youtube",
] as const;

/**
 * User context schema (optional fields)
 */
export const userContextSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    position: z.string().min(1).max(100).optional(),
    companyName: z.string().min(1).max(200).optional(),
    city: z.string().min(1).max(100).optional(),
    socialHandles: z.string().min(1).max(100).optional(),
  })
  .optional();

/**
 * Validation schema for generate dynamic posts request
 */
export const generateDynamicPostsSchema = z.object({
  topic: z
    .string()
    .min(1, "Topic is required")
    .max(500, "Topic too long"),
  keyPoints: z.preprocess(
    (val) => {
      // Convert array to string if needed
      if (Array.isArray(val)) {
        return val.join(", ");
      }
      return val;
    },
    z.string().min(1, "Key points are required")
  ),
  platforms: z.preprocess(
    (val) => {
      if (!val) return DEFAULT_PLATFORMS;
      return Array.isArray(val) ? val : [val];
    },
    z.array(z.enum(VALID_PLATFORMS))
  ).optional(),
  userContext: userContextSchema,
});

/**
 * Validation schema for test dynamic posts request
 */
export const testDynamicPostsSchema = generateDynamicPostsSchema;

/**
 * Validation schema for get post history query parameters
 */
export const getPostHistoryQuerySchema = z.object({
  platform: z
    .string()
    .refine(
      (val) => VALID_PLATFORMS.includes(val as any),
      "Invalid platform. Must be one of: instagram, facebook, linkedin, twitter, tiktok, youtube"
    )
    .optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const num = val ? Number(val) : 10;
      return isNaN(num) || num < 1 || num > 100 ? 10 : num;
    }),
});

/**
 * Validation schema for get post analytics query parameters
 */
export const getPostAnalyticsQuerySchema = z.object({
  platform: z
    .string()
    .refine(
      (val) => VALID_PLATFORMS.includes(val as any),
      "Invalid platform. Must be one of: instagram, facebook, linkedin, twitter, tiktok, youtube"
    )
    .optional(),
  days: z
    .string()
    .optional()
    .transform((val) => {
      const num = val ? Number(val) : 30;
      return isNaN(num) || num < 1 || num > 365 ? 30 : num;
    }),
});

/**
 * Validation schema for get templates query parameters
 */
export const getTemplatesQuerySchema = z.object({
  platform: z
    .string()
    .refine(
      (val) => VALID_PLATFORMS.includes(val as any),
      "Invalid platform. Must be one of: instagram, facebook, linkedin, twitter, tiktok, youtube"
    )
    .optional(),
  variant: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const num = Number(val);
      return isNaN(num) || num < 0 ? undefined : num;
    }),
});

// Note: scheduleIdParamSchema is imported from videoSchedule.validations.ts to avoid duplication

// ==================== TYPE INFERENCES ====================

/**
 * Type inference for generate dynamic posts data
 */
export type GenerateDynamicPostsData = z.infer<
  typeof generateDynamicPostsSchema
>;

/**
 * Type inference for test dynamic posts data
 */
export type TestDynamicPostsData = z.infer<typeof testDynamicPostsSchema>;

/**
 * Type inference for get post history query data
 */
export type GetPostHistoryQueryData = z.infer<
  typeof getPostHistoryQuerySchema
>;

/**
 * Type inference for get post analytics query data
 */
export type GetPostAnalyticsQueryData = z.infer<
  typeof getPostAnalyticsQuerySchema
>;

/**
 * Type inference for get templates query data
 */
export type GetTemplatesQueryData = z.infer<typeof getTemplatesQuerySchema>;

// ScheduleIdParamData is imported from videoSchedule.validations

// ==================== VALIDATION RESULT INTERFACES ====================

export interface GenerateDynamicPostsValidationResult {
  success: boolean;
  data?: GenerateDynamicPostsData;
  errors?: ValidationError[];
}

export interface TestDynamicPostsValidationResult {
  success: boolean;
  data?: TestDynamicPostsData;
  errors?: ValidationError[];
}

export interface GetPostHistoryQueryValidationResult {
  success: boolean;
  data?: GetPostHistoryQueryData;
  errors?: ValidationError[];
}

export interface GetPostAnalyticsQueryValidationResult {
  success: boolean;
  data?: GetPostAnalyticsQueryData;
  errors?: ValidationError[];
}

export interface GetTemplatesQueryValidationResult {
  success: boolean;
  data?: GetTemplatesQueryData;
  errors?: ValidationError[];
}

// ScheduleIdParamValidationResult is imported from videoSchedule.validations

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate generate dynamic posts request data
 * @param data - The data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateGenerateDynamicPosts(
  data: unknown
): GenerateDynamicPostsValidationResult {
  const validationResult = generateDynamicPostsSchema.safeParse(data);

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
 * Validate test dynamic posts request data
 * @param data - The data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateTestDynamicPosts(
  data: unknown
): TestDynamicPostsValidationResult {
  const validationResult = testDynamicPostsSchema.safeParse(data);

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
 * Validate get post history query parameters
 * @param data - The query data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateGetPostHistoryQuery(
  data: unknown
): GetPostHistoryQueryValidationResult {
  const validationResult = getPostHistoryQuerySchema.safeParse(data);

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
 * Validate get post analytics query parameters
 * @param data - The query data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateGetPostAnalyticsQuery(
  data: unknown
): GetPostAnalyticsQueryValidationResult {
  const validationResult = getPostAnalyticsQuerySchema.safeParse(data);

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
 * Validate get templates query parameters
 * @param data - The query data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateGetTemplatesQuery(
  data: unknown
): GetTemplatesQueryValidationResult {
  const validationResult = getTemplatesQuerySchema.safeParse(data);

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

// Re-export validateScheduleIdParam from videoSchedule.validations for convenience
export { validateScheduleIdParam } from "./videoSchedule.validations";

