import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Save token validation schema
 */
export const saveTokenSchema = z.object({
  authToken: z.string().min(1, "Auth token is required"),
  id: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Email must be a valid email address"),
  verified: z.boolean().optional().default(false),
});

/**
 * Connect account validation schema
 */
export const connectAccountSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  postback_url: z
    .string()
    .url("Postback URL must be a valid URL")
    .optional(),
  account_id: z.string().optional(),
  user_id: z.string().optional(), // Optional since we can get it from auth
});

/**
 * Get posts validation schema
 */
export const getPostsSchema = z.object({
  type: z.string().optional(),
  account_id: z.union([z.string(), z.number()]).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
  offset: z.union([z.string(), z.number()]).optional(),
});

/**
 * Get insights validation schema
 */
export const getInsightsSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  metrics: z.union([z.string(), z.array(z.string())]).optional(),
});

/**
 * Get scheduled posts validation schema
 */
export const getScheduledPostsSchema = z.object({
  user_id: z.string().optional(), // Optional since we can get it from auth
});

// ==================== TYPE INFERENCES ====================

export type SaveTokenData = z.infer<typeof saveTokenSchema>;
export type ConnectAccountData = z.infer<typeof connectAccountSchema>;
export type GetPostsData = z.infer<typeof getPostsSchema>;
export type GetInsightsData = z.infer<typeof getInsightsSchema>;
export type GetScheduledPostsData = z.infer<typeof getScheduledPostsSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface SaveTokenValidationResult {
  success: boolean;
  data?: SaveTokenData;
  errors?: ValidationError[];
}

export interface ConnectAccountValidationResult {
  success: boolean;
  data?: ConnectAccountData;
  errors?: ValidationError[];
}

export interface GetPostsValidationResult {
  success: boolean;
  data?: GetPostsData;
  errors?: ValidationError[];
}

export interface GetInsightsValidationResult {
  success: boolean;
  data?: GetInsightsData;
  errors?: ValidationError[];
}

export interface GetScheduledPostsValidationResult {
  success: boolean;
  data?: GetScheduledPostsData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate save token request data
 */
export function validateSaveToken(data: unknown): SaveTokenValidationResult {
  const validationResult = saveTokenSchema.safeParse(data);

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
 * Validate connect account request data
 */
export function validateConnectAccount(
  data: unknown
): ConnectAccountValidationResult {
  const validationResult = connectAccountSchema.safeParse(data);

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
 * Validate get posts request data
 */
export function validateGetPosts(data: unknown): GetPostsValidationResult {
  const validationResult = getPostsSchema.safeParse(data);

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
 * Validate get insights request data
 */
export function validateGetInsights(
  data: unknown
): GetInsightsValidationResult {
  const validationResult = getInsightsSchema.safeParse(data);

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
 * Validate get scheduled posts request data
 */
export function validateGetScheduledPosts(
  data: unknown
): GetScheduledPostsValidationResult {
  const validationResult = getScheduledPostsSchema.safeParse(data);

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

