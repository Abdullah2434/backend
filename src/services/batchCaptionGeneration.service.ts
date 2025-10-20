import DynamicCaptionGenerationService, {
  UserContext,
} from "./dynamicCaptionGeneration.service";
import { VideoData } from "./dynamicPostGeneration.service";

export interface BatchCaptionRequest {
  userId: string;
  topics: Array<{
    topic: string;
    keyPoints: string;
  }>;
  userContext?: UserContext;
}

export interface BatchCaptionResult {
  success: boolean;
  results: Array<{
    topic: string;
    keyPoints: string;
    captions?: {
      youtube_caption: string;
      instagram_caption: string;
      tiktok_caption: string;
      facebook_caption: string;
      linkedin_caption: string;
      twitter_caption: string;
    };
    error?: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

export class BatchCaptionGenerationService {
  /**
   * Generate captions for multiple topics in batch
   * Useful for content planning and bulk generation
   */
  static async generateBatchCaptions(
    request: BatchCaptionRequest
  ): Promise<BatchCaptionResult> {
    const { userId, topics, userContext } = request;
    const results: BatchCaptionResult["results"] = [];
    let successCount = 0;
    let failureCount = 0;

    console.log(
      `🚀 Starting batch caption generation for ${topics.length} topics`
    );

    // Process topics sequentially to avoid overwhelming the AI services
    for (let i = 0; i < topics.length; i++) {
      const { topic, keyPoints } = topics[i];

      try {
        console.log(`📝 Processing topic ${i + 1}/${topics.length}: ${topic}`);

        // Prepare video data
        const videoData: VideoData = {
          VIDEO_TOPIC: topic,
          SCRIPT_HOOK: topic,
          SCRIPT_SUMMARY: keyPoints,
          AGENT_NAME: userContext?.name || "Real Estate Professional",
          AGENT_CITY: userContext?.city || "Your City",
          AGENT_EMAIL: userContext?.email,
        };

        // Generate dynamic captions
        const captions =
          await DynamicCaptionGenerationService.generateDynamicCaptions(
            userId,
            videoData,
            userContext
          );

        results.push({
          topic,
          keyPoints,
          captions,
        });

        successCount++;
        console.log(`✅ Successfully generated captions for: ${topic}`);

        // Add delay between requests to avoid rate limiting
        if (i < topics.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(
          `❌ Error generating captions for topic "${topic}":`,
          error
        );

        results.push({
          topic,
          keyPoints,
          error: error.message || "Failed to generate captions",
        });

        failureCount++;
      }
    }

    console.log(
      `🎉 Batch caption generation completed: ${successCount} success, ${failureCount} failed`
    );

    return {
      success: failureCount === 0,
      results,
      totalProcessed: topics.length,
      successCount,
      failureCount,
    };
  }

  /**
   * Generate captions for a content calendar (weekly/monthly planning)
   */
  static async generateContentCalendar(
    userId: string,
    userContext: UserContext,
    options: {
      weeks: number;
      postsPerWeek: number;
      topics?: string[];
    }
  ): Promise<BatchCaptionResult> {
    const { weeks, postsPerWeek, topics } = options;
    const totalPosts = weeks * postsPerWeek;

    console.log(
      `📅 Generating content calendar: ${weeks} weeks, ${postsPerWeek} posts/week = ${totalPosts} total posts`
    );

    // If no topics provided, generate trending topics
    let topicsToUse = topics;
    if (!topicsToUse || topicsToUse.length === 0) {
      console.log("🎯 No topics provided, generating trending topics...");
      const GrokGenerationService = require("./grokGeneration.service").default;
      const trends = await GrokGenerationService.generateRealEstateTrends(
        totalPosts,
        0,
        0,
        [userId]
      );
      topicsToUse = trends.map((trend) => trend.description);
    }

    // Create batch request
    const batchRequest: BatchCaptionRequest = {
      userId,
      topics: topicsToUse.slice(0, totalPosts).map((topic) => ({
        topic,
        keyPoints: "Key insights and market updates", // Could be enhanced with actual key points
      })),
      userContext,
    };

    return this.generateBatchCaptions(batchRequest);
  }

  /**
   * Generate captions for specific platforms only
   */
  static async generatePlatformSpecificCaptions(
    userId: string,
    topics: Array<{ topic: string; keyPoints: string }>,
    platforms: string[],
    userContext?: UserContext
  ): Promise<BatchCaptionResult> {
    const results: BatchCaptionResult["results"] = [];
    let successCount = 0;
    let failureCount = 0;

    console.log(
      `🎯 Generating platform-specific captions for: ${platforms.join(", ")}`
    );

    for (const { topic, keyPoints } of topics) {
      try {
        const videoData: VideoData = {
          VIDEO_TOPIC: topic,
          SCRIPT_HOOK: topic,
          SCRIPT_SUMMARY: keyPoints,
          AGENT_NAME: userContext?.name || "Real Estate Professional",
          AGENT_CITY: userContext?.city || "Your City",
          AGENT_EMAIL: userContext?.email,
        };

        const captions =
          await DynamicCaptionGenerationService.generateDynamicCaptions(
            userId,
            videoData,
            userContext
          );

        // Filter captions to only include requested platforms
        const filteredCaptions: any = {};
        platforms.forEach((platform) => {
          const platformKey = `${platform}_caption` as keyof typeof captions;
          if (captions[platformKey]) {
            filteredCaptions[platformKey] = captions[platformKey];
          }
        });

        results.push({
          topic,
          keyPoints,
          captions: filteredCaptions,
        });

        successCount++;
      } catch (error: any) {
        results.push({
          topic,
          keyPoints,
          error: error.message || "Failed to generate captions",
        });
        failureCount++;
      }
    }

    return {
      success: failureCount === 0,
      results,
      totalProcessed: topics.length,
      successCount,
      failureCount,
    };
  }
}

export default BatchCaptionGenerationService;

