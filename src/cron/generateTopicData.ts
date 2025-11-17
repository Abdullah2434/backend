import axios, { AxiosResponse } from "axios";
import Topic, { ITopic } from "../models/Topic";
import dotenv from "dotenv";
import { connectMongo } from "../config/mongoose";
import CronMonitoringService from "../services/cronMonitoring.service";
import {
  executeWithOverallTimeout,
  withDatabaseTimeout,
  withApiTimeout,
  retryWithBackoff,
} from "../utils/cronHelpers";
import { getCronConfig } from "../config/cron.config";
import {
  topicDataSchema,
  openAIResponseSchema,
  topicNameSchema,
  VALID_TOPICS,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_DELAY_BETWEEN_TOPICS_MS,
  EXPECTED_TOPIC_DATA_COUNT,
} from "../validations/generateTopicData.validations";
import {
  OpenAIResponse,
  TopicData,
  TopicDataGenerationResult,
  GenerateTopicDataSummary,
  GenerateTopicDataConfig,
  OpenAIRequestPayload,
} from "../types/cron/generateTopicData.types";

// ==================== CONSTANTS ====================
dotenv.config();

const CRON_JOB_NAME = "generate-topic-data";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ==================== SERVICE INSTANCE ====================
const cronMonitor = CronMonitoringService.getInstance();

// ==================== HELPER FUNCTIONS ====================
/**
 * Validate environment configuration
 */
function validateEnvironmentConfig(): { valid: boolean; error?: string } {
  if (!OPENAI_API_KEY) {
    return {
      valid: false,
      error: "OPENAI_API_KEY environment variable is required",
    };
  }
  return { valid: true };
}

/**
 * Validate topic name
 */
function validateTopicName(topic: string): boolean {
  return VALID_TOPICS.includes(topic as any);
}

/**
 * Clean and parse JSON content from OpenAI response
 */
function parseJSONContent(content: string): any[] | null {
  try {
    // Remove markdown code blocks if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "");
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsedData = JSON.parse(cleanContent);

    // Ensure it's an array
    if (!Array.isArray(parsedData)) {
      console.warn("Parsed data is not an array:", typeof parsedData);
      return null;
    }

    return parsedData;
  } catch (parseError: any) {
    console.error(
      "Error parsing JSON content:",
      parseError?.message || parseError
    );
    return null;
  }
}

/**
 * Transform and validate topic data from OpenAI response
 */
function transformTopicData(parsedData: any[]): TopicData[] {
  const validatedData: TopicData[] = [];

  for (const item of parsedData) {
    const validationResult = topicDataSchema.safeParse(item);

    if (!validationResult.success) {
      console.warn("Invalid topic data item:", validationResult.error.errors);
      continue;
    }

    const validated = validationResult.data;

    // Handle keypoints - convert array to string if needed
    let keypoints = validated.keypoints;
    if (Array.isArray(keypoints)) {
      keypoints = keypoints.join(", ");
    }

    validatedData.push({
      description: validated.description,
      keypoints: keypoints as string,
    });
  }

  return validatedData;
}

/**
 * Build OpenAI request prompt for topic generation
 */
function buildTopicGenerationPrompt(topic: string): string {
  return `Generate ${EXPECTED_TOPIC_DATA_COUNT} different latest trending ${topic} content pieces. Each should focus on a different aspect of the ${topic} industry. Provide:

For each of the ${EXPECTED_TOPIC_DATA_COUNT} pieces, include:
1. A comprehensive description (5-6 words that look like a title) about current ${topic} trends
2. Key points covering the most important aspects not more than 5 words.

Format your response as JSON array:
[
  {
    "description": "Description for piece 1",
    "keypoints": "Key points for piece 1"
  },
  {
    "description": "Description for piece 2", 
    "keypoints": "Key points for piece 2"
  },
  {
    "description": "Description for piece 3",
    "keypoints": "Key points for piece 3"
  },
  {
    "description": "Description for piece 4",
    "keypoints": "Key points for piece 4"
  },
  {
    "description": "Description for piece 5",
    "keypoints": "Key points for piece 5"
  }
]

Make each piece current, relevant, and engaging for ${topic} professionals and stakeholders. Focus on different aspects like market trends, technology, investment opportunities, regulatory changes, and consumer behavior.`;
}

/**
 * Build OpenAI request payload
 */
function buildOpenAIRequestPayload(
  topic: string,
  prompt: string
): OpenAIRequestPayload {
  return {
    model: DEFAULT_OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a ${topic} market analyst providing current, accurate, and engaging market insights.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: DEFAULT_MAX_TOKENS,
  };
}

/**
 * Generate multiple topic data entries using ChatGPT
 */
async function generateMultipleTopicDataWithChatGPT(
  topic: string,
  config: GenerateTopicDataConfig
): Promise<TopicData[]> {
  // Validate topic name
  if (!validateTopicName(topic)) {
    console.error(`Invalid topic name: ${topic}`);
    return [];
  }

  try {
    const prompt = buildTopicGenerationPrompt(topic);
    const payload = buildOpenAIRequestPayload(topic, prompt);

    const response: AxiosResponse<OpenAIResponse> = await axios.post(
      OPENAI_API_URL,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        ...withApiTimeout(config.apiTimeoutMs),
      }
    );

    // Validate API response
    const validationResult = openAIResponseSchema.safeParse(response.data);
    if (!validationResult.success) {
      console.error(
        "Invalid OpenAI API response:",
        validationResult.error.errors
      );
      return [];
    }

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      console.warn("No content in OpenAI response");
      return [];
    }

    // Parse JSON content
    const parsedData = parseJSONContent(content);
    if (!parsedData) {
      console.warn(
        "Failed to parse JSON content. Raw response:",
        content.substring(0, 200)
      );
      return [];
    }

    // Transform and validate topic data
    const topicData = transformTopicData(parsedData);

    if (topicData.length === 0) {
      console.warn("No valid topic data after transformation");
      return [];
    }

    return topicData;
  } catch (error: any) {
    console.error(
      `Error generating topic data for ${topic}:`,
      error?.response?.status || error?.message || error
    );
    return [];
  }
}

/**
 * Process a single topic: generate and store data
 */
async function processTopic(
  topic: string,
  config: GenerateTopicDataConfig
): Promise<TopicDataGenerationResult> {
  try {
    // Generate all documents for this topic in one API call with retry
    const topicDataArray = await retryWithBackoff(
      () => generateMultipleTopicDataWithChatGPT(topic, config),
      config.maxRetries,
      config.retryInitialDelayMs
    );

    if (!topicDataArray || topicDataArray.length === 0) {
      return {
        success: false,
        topic,
        generatedCount: 0,
        error: "No topic data generated",
      };
    }

    // Create all documents for this topic with database timeout
    let createdCount = 0;
    for (const topicData of topicDataArray) {
      try {
        await withDatabaseTimeout(
          Topic.create({
            topic,
            description: topicData.description,
            keypoints: topicData.keypoints,
          }),
          config.databaseTimeoutMs
        );
        createdCount++;
      } catch (dbError: any) {
        console.error(
          `Error creating topic document for ${topic}:`,
          dbError?.message || dbError
        );
      }
    }

    return {
      success: createdCount > 0,
      topic,
      generatedCount: createdCount,
      error: createdCount === 0 ? "Failed to create any documents" : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      topic,
      generatedCount: 0,
      error: error?.message || "Unknown error",
    };
  }
}

// ==================== MAIN FUNCTION ====================
/**
 * Generate and store topic data for all available topics
 */
export async function generateAndStoreTopicData(): Promise<GenerateTopicDataSummary | null> {
  const config = getCronConfig(CRON_JOB_NAME);

  // Validate environment configuration
  const envValidation = validateEnvironmentConfig();
  if (!envValidation.valid) {
    console.warn(`⚠️ ${envValidation.error}, skipping topic data generation`);
    return null;
  }

  try {
    await connectMongo();

    // Delete ALL existing topics first with database timeout
    const deleteResult = await withDatabaseTimeout(
      Topic.deleteMany({}),
      config.databaseTimeoutMs
    );

    console.log(
      `🗑️ Deleted ${deleteResult.deletedCount || 0} existing topic(s)`
    );

    const results: TopicDataGenerationResult[] = [];
    const errors: string[] = [];

    // Generate data for each topic in the array
    for (let i = 0; i < VALID_TOPICS.length; i++) {
      const topic = VALID_TOPICS[i];

      const result = await processTopic(topic, {
        maxRetries: config.maxRetries,
        retryInitialDelayMs: config.retryInitialDelayMs,
        overallTimeoutMs: config.overallTimeoutMs,
        apiTimeoutMs: config.apiTimeoutMs,
        databaseTimeoutMs: config.databaseTimeoutMs,
        delayBetweenTopicsMs: DEFAULT_DELAY_BETWEEN_TOPICS_MS,
      });

      results.push(result);

      if (!result.success) {
        errors.push(`${topic}: ${result.error || "Unknown error"}`);
        console.warn(`⚠️ No topic data generated for ${topic}, skipping`);
      } else {
        console.log(
          `✅ Generated ${result.generatedCount} topic data entry/entries for ${topic}`
        );
      }

      // Add a delay between topics to avoid rate limiting (except for last topic)
      if (i < VALID_TOPICS.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, DEFAULT_DELAY_BETWEEN_TOPICS_MS)
        );
      }
    }

    // Calculate summary
    const successfulTopics = results.filter((r) => r.success).length;
    const failedTopics = results.filter((r) => !r.success).length;
    const totalGenerated = results.reduce(
      (sum, r) => sum + r.generatedCount,
      0
    );

    const summary: GenerateTopicDataSummary = {
      totalTopics: VALID_TOPICS.length,
      successfulTopics,
      failedTopics,
      totalGenerated,
      errors,
    };

    console.log(
      `✅ Topic data generation completed: ${successfulTopics}/${VALID_TOPICS.length} topics successful, ${totalGenerated} entries generated`
    );

    return summary;
  } catch (error: any) {
    console.error("❌ Error generating topic data:", error?.message || error);
    throw error;
  }
}

// For manual run/testing
if (require.main === module) {
  generateAndStoreTopicData()
    .then((result) => {
      if (result) {
        console.log("✅ Manual topic data generation completed:", result);
        process.exit(0);
      } else {
        console.warn(
          "⚠️ Topic data generation skipped (missing configuration)"
        );
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error("❌ Manual topic data generation failed:", error);
      process.exit(1);
    });
}
