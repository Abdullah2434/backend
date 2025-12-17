import { z } from "zod";

// ==================== ELEVEN LABS VALIDATIONS ====================

export const textToSpeechSchema = z
  .object({
    voice_id: z.string().min(1, "voice_id is required"),
    // Single text field option
    text: z.string().min(1, "text must be a non-empty string").optional(),
    // Hook/body/conclusion option
    hook: z.string().min(1, "hook must be a non-empty string").optional(),
    body: z.string().min(1, "body must be a non-empty string").optional(),
    conclusion: z
      .string()
      .min(1, "conclusion must be a non-empty string")
      .optional(),
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
  })
  .refine(
    (data) => {
      // Either text is provided, OR hook/body/conclusion are all provided
      const hasText = !!data.text;
      const hasHookBodyConclusion =
        !!data.hook && !!data.body && !!data.conclusion;
      return hasText || hasHookBodyConclusion;
    },
    {
      message:
        "Either 'text' field OR all of 'hook', 'body', and 'conclusion' fields must be provided",
    }
  )
  .refine(
    (data) => {
      // Don't allow both text and hook/body/conclusion
      const hasText = !!data.text;
      const hasHookBodyConclusion =
        !!data.hook && !!data.body && !!data.conclusion;
      return !(hasText && hasHookBodyConclusion);
    },
    {
      message:
        "Cannot provide both 'text' and 'hook/body/conclusion' fields. Use one or the other.",
    }
  );

export const addCustomVoiceSchema = z.object({
  name: z.string().min(1, "Name is required and must be a non-empty string"),
  description: z.string().optional(),
  language: z.string().optional(),
  gender: z.string().optional(),
});
