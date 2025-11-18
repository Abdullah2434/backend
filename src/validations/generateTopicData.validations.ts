import { z } from "zod";

/**
 * Validation schema for topic data from OpenAI response
 */
export const topicDataSchema = z.object({
  description: z.string().min(1, "description is required"),
  keypoints: z.union([
    z.string().min(1, "keypoints is required"),
    z.array(z.string()).min(1, "keypoints array must not be empty"),
  ]),
});

/**
 * Validation schema for OpenAI API response
 */
export const openAIResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().min(1, "content is required"),
        }),
      })
    )
    .min(1, "choices array must not be empty"),
});

/**
 * Validation schema for topic name
 */
export const topicNameSchema = z.enum(["real_estate"]);

/**
 * Valid topic names (matches Topic model enum)
 */
export const VALID_TOPICS = ["real_estate"] as const;

/**
 * Default values
 */
export const DEFAULT_OPENAI_MODEL = "gpt-4";
export const DEFAULT_TEMPERATURE = 0.8;
export const DEFAULT_MAX_TOKENS = 2000;
export const DEFAULT_DELAY_BETWEEN_TOPICS_MS = 2000;
export const EXPECTED_TOPIC_DATA_COUNT = 5;

