import axios from "axios";
import {
  TrendsConfig,
  TrendGenerationRequest,
  TrendGenerationResult,
  TrendData,
  TrendsServiceInterface,
} from "../types/trends.types";
import {
  logTrendsEvent,
  logTrendsError,
  getTrendsConfig,
  formatTrendData,
  generateId,
} from "../utils/trends.utils";

export class TrendsService implements TrendsServiceInterface {
  private readonly config: TrendsConfig;

  constructor() {
    this.config = getTrendsConfig();

    if (!this.config.apiKey) {
      console.warn("TRENDS_API_KEY not set, using mock data");
    }
  }

  // ==================== TREND GENERATION ====================

  async generateRealEstateTrends(): Promise<TrendGenerationResult> {
    try {
      logTrendsEvent("generating_real_estate_trends", {
        location: this.config.defaultLocation,
        limit: this.config.defaultLimit,
      });

      // Always generate fresh trends from OpenAI
      const trends = await this.generateOpenAIRealEstateTrends();

      logTrendsEvent("real_estate_trends_generated", {
        count: trends.length,
        location: this.config.defaultLocation,
      });

      return {
        success: true,
        trends,
        count: trends.length,
        metadata: {
          category: "real_estate",
          location: this.config.defaultLocation,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logTrendsError(error, { action: "generateRealEstateTrends" });
      throw new Error(
        `Failed to generate real estate trends: ${error.message}`
      );
    }
  }

  async generateTrends(
    request: TrendGenerationRequest
  ): Promise<TrendGenerationResult> {
    try {
      logTrendsEvent("generating_trends", {
        topic: request.topic,
        location: request.location,
        category: request.category,
        limit: request.limit,
      });

      if (!this.validateTrendRequest(request)) {
        throw new Error("Invalid trend generation request");
      }

      const trends = await this.generateMockTrends(request);

      logTrendsEvent("trends_generated", {
        topic: request.topic,
        count: trends.length,
        location: request.location,
      });

      return {
        success: true,
        trends,
        count: trends.length,
        metadata: {
          topic: request.topic,
          location: request.location || this.config.defaultLocation,
          category: request.category,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logTrendsError(error, { action: "generateTrends" });
      throw error;
    }
  }

  // ==================== OPENAI GENERATION ====================

  private async generateOpenAIRealEstateTrends(): Promise<TrendData[]> {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    const prompt = `search the latest real estate trends in america

Return the response in this exact JSON format with 5 current trends:

{
  "trends": [
    {
      "description": "Brief description of the trend",
      "keypoints": "Key points separated by commas"
    }
  ]
}`;

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a real estate market analyst. Generate current, relevant real estate trends with accurate information.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content generated from OpenAI API");
      }

      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (parseError) {
        throw new Error("Failed to parse OpenAI response as JSON");
      }

      // Convert OpenAI response to our TrendData format
      const trends: TrendData[] = parsedContent.trends.map(
        (trend: any, index: number) => ({
          id: generateId(),
          title: trend.description,
          description: trend.description,
          category: "real_estate",
          location: "America",
          timestamp: new Date().toISOString(),
          source: "openai",
          confidence: 0.85,
          tags: ["real_estate", "trends", "america"],
          metadata: {
            keypoints: trend.keypoints,
            generatedBy: "openai",
            model: "gpt-3.5-turbo",
          },
        })
      );

      return trends.map(formatTrendData);
    } catch (error: any) {
      console.error("OpenAI API error:", error.message);
      throw new Error(`OpenAI API failed: ${error.message}`);
    }
  }

  private async generateMockTrends(
    request: TrendGenerationRequest
  ): Promise<TrendData[]> {
    const { topic, location, category, limit = 5 } = request;

    const mockTrends = [
      {
        id: generateId(),
        title: `${topic} Market Analysis`,
        description: `Comprehensive analysis of ${topic} trends in ${
          location || "global markets"
        }.`,
        category: category || "general",
        location: location || "global",
        timestamp: new Date().toISOString(),
        source: "market_research",
        confidence: 0.75,
        tags: [topic.toLowerCase(), "analysis", "market"],
        metadata: {
          topic,
          location: location || "global",
          category: category || "general",
        },
      },
      {
        id: generateId(),
        title: `${topic} Innovation Trends`,
        description: `Latest innovations and developments in the ${topic} sector.`,
        category: category || "general",
        location: location || "global",
        timestamp: new Date().toISOString(),
        source: "innovation_report",
        confidence: 0.68,
        tags: [topic.toLowerCase(), "innovation", "development"],
        metadata: {
          topic,
          location: location || "global",
          category: category || "general",
        },
      },
      {
        id: generateId(),
        title: `${topic} Consumer Behavior`,
        description: `Analysis of consumer behavior patterns related to ${topic}.`,
        category: category || "general",
        location: location || "global",
        timestamp: new Date().toISOString(),
        source: "consumer_research",
        confidence: 0.82,
        tags: [topic.toLowerCase(), "consumer", "behavior"],
        metadata: {
          topic,
          location: location || "global",
          category: category || "general",
        },
      },
    ];

    return mockTrends.slice(0, limit).map(formatTrendData);
  }

  // ==================== VALIDATION ====================

  validateTrendRequest(request: TrendGenerationRequest): boolean {
    if (!request.topic || request.topic.length < 2) {
      return false;
    }

    if (request.location && request.location.length < 2) {
      return false;
    }

    if (request.limit && (request.limit < 1 || request.limit > 100)) {
      return false;
    }

    return true;
  }

  getTrendCategories(): string[] {
    return [
      "real_estate",
      "technology",
      "finance",
      "healthcare",
      "education",
      "entertainment",
      "sports",
      "politics",
      "environment",
      "business",
    ];
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      // Check if configuration is valid
      const configValid =
        !!this.config.apiKey || process.env.NODE_ENV === "development";

      return {
        status: configValid ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logTrendsError(error, { action: "healthCheck" });
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default TrendsService;
