import { z } from "zod";
import { ValidationError } from "../types";

/**
 * Validation schema for reset cron stats request
 */
export const resetCronStatsSchema = z.object({
  jobName: z
    .string()
    .min(1, "Job name must be a non-empty string")
    .max(100, "Job name too long")
    .optional(),
});

/**
 * Type inference for reset cron stats data
 */
export type ResetCronStatsData = z.infer<typeof resetCronStatsSchema>;

/**
 * Validation result interface
 */
export interface ResetCronStatsValidationResult {
  success: boolean;
  data?: ResetCronStatsData;
  errors?: ValidationError[];
}

/**
 * Validate reset cron stats request data
 * @param data - The data to validate
 * @returns Validation result with either validated data or errors
 */
export function validateResetCronStats(
  data: unknown
): ResetCronStatsValidationResult {
  const validationResult = resetCronStatsSchema.safeParse(data);

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

