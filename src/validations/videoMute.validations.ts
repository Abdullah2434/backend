import { z } from "zod";
import { ValidationError } from "../types";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Mute video validation schema
 * Supports both array and object with numeric keys (URL-encoded form data)
 */
export const muteVideoSchema = z
  .union([
    z.array(z.string().url("Each item must be a valid URL")),
    z.record(z.string()).transform((val) => {
      // Convert object with numeric keys to array
      const keys = Object.keys(val);
      const allNumericKeys = keys.every((key) => /^\d+$/.test(key));

      if (allNumericKeys && keys.length > 0) {
        return keys
          .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
          .map((key) => val[key])
          .filter(
            (url): url is string => typeof url === "string" && url.trim() !== ""
          );
      }

      throw new Error(
        "Invalid format: must be an array of URLs or object with numeric keys"
      );
    }),
  ])
  .refine(
    (val) => Array.isArray(val) && val.length > 0,
    "At least one video URL is required"
  )
  .refine(
    (val) => {
      if (!Array.isArray(val)) return false;
      return val.every((url) => {
        try {
          new URL(url);
          return url.trim() !== "";
        } catch {
          return false;
        }
      });
    },
    {
      message: "All URLs must be valid and non-empty",
    }
  );

// ==================== TYPE INFERENCES ====================

export type MuteVideoData = z.infer<typeof muteVideoSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface MuteVideoValidationResult {
  success: boolean;
  data?: MuteVideoData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate mute video request data
 */
export function validateMuteVideo(data: unknown): MuteVideoValidationResult {
  const validationResult = muteVideoSchema.safeParse(data);

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

