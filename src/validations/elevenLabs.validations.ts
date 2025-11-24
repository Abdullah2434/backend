import { z } from "zod";
import { ValidationError } from "../types";
import {
  ELEVEN_LABS_MODELS,
  VALID_ENERGY_CATEGORIES,
  VALID_GENDERS,
} from "../constants/elevenLabs.constants";

// ==================== VALIDATION SCHEMAS ====================

/**
 * Text-to-speech request validation schema
 */
export const textToSpeechSchema = z.object({
  voice_id: z.string().min(1, "voice_id is required"),
  hook: z.string().min(1, "hook is required and must be a non-empty string"),
  body: z.string().min(1, "body is required and must be a non-empty string"),
  conclusion: z
    .string()
    .min(1, "conclusion is required and must be a non-empty string"),
  output_format: z.string().optional(),
  model_id: z
    .string()
    .refine(
      (val) => !val || ELEVEN_LABS_MODELS.includes(val as any),
      `Invalid model_id. Valid models: ${ELEVEN_LABS_MODELS.join(", ")}`
    )
    .optional(),
  apply_text_normalization: z.enum(["auto", "on", "off"]).optional(),
  seed: z.number().int().min(0).max(4294967295).nullable().optional(),
  pronunciation_dictionary_locators: z
    .array(
      z.object({
        pronunciation_dictionary_id: z.string(),
        version_id: z.string().nullable().optional(),
      })
    )
    .max(3)
    .optional()
    .nullable(),
});

/**
 * Add custom voice request validation schema
 */
export const addCustomVoiceSchema = z.object({
  name: z.string().min(1, "Name is required and must be a non-empty string"),
  description: z.string().optional(),
  language: z.string().optional(),
  gender: z
    .string()
    .refine(
      (val) => !val || VALID_GENDERS.includes(val.toLowerCase() as any),
      `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`
    )
    .optional(),
});

/**
 * Get voices query parameters validation schema
 */
export const getVoicesQuerySchema = z.object({
  energyCategory: z
    .string()
    .refine(
      (val) => VALID_ENERGY_CATEGORIES.includes(val.toLowerCase() as any),
      `Invalid energy category. Must be one of: ${VALID_ENERGY_CATEGORIES.join(
        ", "
      )}`
    )
    .optional()
    .transform((val) => (val ? val.toLowerCase() : undefined)),
  gender: z
    .string()
    .refine(
      (val) => VALID_GENDERS.includes(val.toLowerCase() as any),
      `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`
    )
    .optional()
    .transform((val) => (val ? val.toLowerCase() : undefined)),
});

/**
 * Get voice by ID route parameter validation schema
 */
export const voiceIdParamSchema = z.object({
  voice_id: z.string().min(1, "voice_id is required"),
});

// ==================== TYPE INFERENCES ====================

export type TextToSpeechData = z.infer<typeof textToSpeechSchema>;
export type AddCustomVoiceData = z.infer<typeof addCustomVoiceSchema>;
export type GetVoicesQueryData = z.infer<typeof getVoicesQuerySchema>;
export type VoiceIdParamData = z.infer<typeof voiceIdParamSchema>;

// ==================== VALIDATION RESULT INTERFACES ====================

export interface TextToSpeechValidationResult {
  success: boolean;
  data?: TextToSpeechData;
  errors?: ValidationError[];
}

export interface AddCustomVoiceValidationResult {
  success: boolean;
  data?: AddCustomVoiceData;
  errors?: ValidationError[];
}

export interface GetVoicesQueryValidationResult {
  success: boolean;
  data?: GetVoicesQueryData;
  errors?: ValidationError[];
}

export interface VoiceIdParamValidationResult {
  success: boolean;
  data?: VoiceIdParamData;
  errors?: ValidationError[];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate text-to-speech request data
 */
export function validateTextToSpeech(
  data: unknown
): TextToSpeechValidationResult {
  const validationResult = textToSpeechSchema.safeParse(data);

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
 * Validate add custom voice request data
 */
export function validateAddCustomVoice(
  data: unknown
): AddCustomVoiceValidationResult {
  const validationResult = addCustomVoiceSchema.safeParse(data);

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
 * Validate get voices query parameters
 */
export function validateGetVoicesQuery(
  data: unknown
): GetVoicesQueryValidationResult {
  const validationResult = getVoicesQuerySchema.safeParse(data);

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
 * Validate voice ID route parameter
 */
export function validateVoiceIdParam(
  data: unknown
): VoiceIdParamValidationResult {
  const validationResult = voiceIdParamSchema.safeParse(data);

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

