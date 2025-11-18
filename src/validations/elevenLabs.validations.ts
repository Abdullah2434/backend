import { z } from "zod";

// ==================== ELEVEN LABS VALIDATIONS ====================

export const textToSpeechSchema = z.object({
  voice_id: z.string().min(1, "voice_id is required"),
  hook: z.string().min(1, "hook is required and must be a non-empty string"),
  body: z.string().min(1, "body is required and must be a non-empty string"),
  conclusion: z
    .string()
    .min(1, "conclusion is required and must be a non-empty string"),
  output_format: z.string().optional(),
  model_id: z.string().optional(),
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

export const addCustomVoiceSchema = z.object({
  name: z.string().min(1, "Name is required and must be a non-empty string"),
  description: z.string().optional(),
  language: z.string().optional(),
  gender: z.string().optional(),
});

