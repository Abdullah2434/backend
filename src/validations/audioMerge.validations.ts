import { z } from "zod";

/**
 * Validation schema for audio merge request
 */
export const mergeAudioFilesSchema = z.object({
  urls: z
    .array(
      z
        .string()
        .min(1, "URL cannot be empty")
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
        )
    )
    .min(1, "At least one URL is required")
    .max(100, "Maximum 100 URLs allowed"), // Reasonable limit
});

