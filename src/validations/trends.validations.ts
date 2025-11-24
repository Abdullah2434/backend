import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Get city-based trends validation schema
 */
export const getCityBasedTrendsSchema = z.object({
  city: z.string().min(1, "City is required"),
  position: z.string().min(1, "Position is required"),
  count: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      return Math.min(Math.max(num || 10, 1), 20);
    })
    .optional()
    .default(10),
  fast: z.boolean().optional().default(false),
  super_fast: z.boolean().optional().default(false),
});

/**
 * Generate content from description validation schema
 */
export const generateContentFromDescriptionSchema = z.object({
  description: z.string().min(1, "Description is required"),
  city: z.string().optional(),
});

// ==================== TYPE INFERENCES ====================

export type GetCityBasedTrendsData = z.infer<typeof getCityBasedTrendsSchema>;
export type GenerateContentFromDescriptionData = z.infer<
  typeof generateContentFromDescriptionSchema
>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface GetCityBasedTrendsValidationResult {
  success: boolean;
  data?: GetCityBasedTrendsData;
  errors?: ValidationError[];
}

export interface GenerateContentFromDescriptionValidationResult {
  success: boolean;
  data?: GenerateContentFromDescriptionData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate get city-based trends request data
 */
export function validateGetCityBasedTrends(
  data: unknown
): GetCityBasedTrendsValidationResult {
  const validationResult = getCityBasedTrendsSchema.safeParse(data);

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
 * Validate generate content from description request data
 */
export function validateGenerateContentFromDescription(
  data: unknown
): GenerateContentFromDescriptionValidationResult {
  const validationResult = generateContentFromDescriptionSchema.safeParse(data);

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

