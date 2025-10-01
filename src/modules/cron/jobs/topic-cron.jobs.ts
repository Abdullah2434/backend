import axios from "axios";
import Topic from "../../../models/Topic";
import { connectMongo } from "../../../config/mongoose";
import {
  CronJob,
  CronJobResult,
  CronJobConfig,
  CronJobCategory,
} from "../types/cron.types";

// ==================== GENERATE TOPIC DATA JOB ====================

export const createGenerateTopicDataJob = (): CronJob => {
  const config: CronJobConfig = {
    name: "generate-topic-data",
    schedule: "0 0 * * 0", // Every Sunday at midnight
    enabled: false, // Disabled by default since it's now an API endpoint
    description: "Generate and store topic data using OpenAI API",
    timeout: 1800000, // 30 minutes
    retries: 2,
    retryDelay: 300000, // 5 minutes
  };

  const execute = async (): Promise<CronJobResult> => {
    const startTime = new Date();

    try {
      await connectMongo();

      const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable is required");
      }

      // Define available topics
      const AVAILABLE_TOPICS: string[] = ["real_estate"];

      let totalGenerated = 0;
      let totalUpdated = 0;
      let totalErrors = 0;

      for (const topicType of AVAILABLE_TOPICS) {
        try {
          const result = await generateTopicDataForType(
            topicType,
            OPENAI_API_URL,
            OPENAI_API_KEY
          );
          totalGenerated += result.generated;
          totalUpdated += result.updated;
          totalErrors += result.errors;
        } catch (error: any) {
          console.error(
            `Failed to generate data for topic ${topicType}:`,
            error.message
          );
          totalErrors++;
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        startTime,
        endTime,
        duration,
        data: {
          totalTopics: AVAILABLE_TOPICS.length,
          totalGenerated,
          totalUpdated,
          totalErrors,
        },
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: false,
        startTime,
        endTime,
        duration,
        error: error.message,
      };
    }
  };

  return {
    config,
    execute,
    onSuccess: (result) => {
      console.log(`Topic data generation completed successfully:`, result.data);
    },
    onError: (error, result) => {
      console.error(`Topic data generation failed:`, error.message);
    },
  };
};

// ==================== CLEANUP OLD TOPIC DATA JOB ====================

export const createCleanupTopicDataJob = (): CronJob => {
  const config: CronJobConfig = {
    name: "cleanup-topic-data",
    schedule: "0 2 * * 1", // Every Monday at 2 AM
    enabled: true,
    description: "Clean up old topic data to maintain database performance",
    timeout: 600000, // 10 minutes
    retries: 2,
    retryDelay: 300000, // 5 minutes
  };

  const execute = async (): Promise<CronJobResult> => {
    const startTime = new Date();

    try {
      await connectMongo();

      // Delete topic data older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deleteResult = await Topic.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
      });

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        startTime,
        endTime,
        duration,
        data: {
          deletedCount: deleteResult.deletedCount,
          cutoffDate: thirtyDaysAgo,
        },
      };
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: false,
        startTime,
        endTime,
        duration,
        error: error.message,
      };
    }
  };

  return {
    config,
    execute,
    onSuccess: (result) => {
      console.log(`Topic data cleanup completed successfully:`, result.data);
    },
    onError: (error, result) => {
      console.error(`Topic data cleanup failed:`, error.message);
    },
  };
};

// ==================== HELPER FUNCTIONS ====================

async function generateTopicDataForType(
  topicType: string,
  apiUrl: string,
  apiKey: string
): Promise<{ generated: number; updated: number; errors: number }> {
  let generated = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Check if topic data already exists for this type
    const existingTopic = await Topic.findOne({ type: topicType });

    if (existingTopic) {
      // Update existing topic data
      const newData = await generateTopicContent(topicType, apiUrl, apiKey);

      existingTopic.data = newData;
      existingTopic.updatedAt = new Date();
      await existingTopic.save();

      updated++;
    } else {
      // Create new topic data
      const newData = await generateTopicContent(topicType, apiUrl, apiKey);

      await Topic.create({
        type: topicType,
        data: newData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      generated++;
    }
  } catch (error: any) {
    console.error(`Error processing topic ${topicType}:`, error.message);
    errors++;
  }

  return { generated, updated, errors };
}

async function generateTopicContent(
  topicType: string,
  apiUrl: string,
  apiKey: string
): Promise<any> {
  const prompt = getPromptForTopicType(topicType);

  const response = await axios.post(
    apiUrl,
    {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates structured topic data for video content creation.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const content = response.data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content generated from OpenAI API");
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    // If JSON parsing fails, return the raw content
    return { content, raw: true };
  }
}

function getPromptForTopicType(topicType: string): string {
  switch (topicType) {
    case "real_estate":
      return `Generate 10 trending real estate topics for video content creation. Each topic should include:
      - title: A catchy title for the video
      - description: A brief description of the topic
      - keywords: Array of relevant keywords
      - target_audience: Who this content is for
      - content_ideas: Array of 3-5 specific content ideas
      
      Return the data as a JSON array. Focus on current trends, market insights, and actionable advice for real estate professionals and investors.`;

    default:
      return `Generate 10 trending topics for ${topicType} video content creation. Each topic should include:
      - title: A catchy title for the video
      - description: A brief description of the topic
      - keywords: Array of relevant keywords
      - target_audience: Who this content is for
      - content_ideas: Array of 3-5 specific content ideas
      
      Return the data as a JSON array.`;
  }
}
