import { z } from "zod";

/**
 * Validation schema for audio duration request
 */
export const getAudioDurationSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .url("Invalid URL format")
    .refine(
      (url) => {
        try {
          const urlObj = new URL(url);
          return urlObj.protocol === "http:" || urlObj.protocol === "https:";
        } catch {
          return false;
        }
      },
      {
        message: "URL must use http or https protocol",
      }
    ),
});

