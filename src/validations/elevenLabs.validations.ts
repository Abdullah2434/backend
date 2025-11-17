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
});

export const addCustomVoiceSchema = z.object({
  name: z.string().min(1, "Name is required and must be a non-empty string"),
  description: z.string().optional(),
  language: z.string().optional(),
  gender: z.string().optional(),
});

