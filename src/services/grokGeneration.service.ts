import axios from "axios";

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_API_KEY = process.env.GROK_API_KEY;

interface GrokResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface TrendData {
  description: string;
  keypoints: string;
  instagram_caption: string;
  facebook_caption: string;
  linkedin_caption: string;
  twitter_caption: string;
  tiktok_caption: string;
  youtube_caption: string;
}

export interface GrokTopicData {
  description: string;
  keypoints: string;
}

export class GrokGenerationService {
  /**
   * Generate real estate trends using Grok with latest trending data
   */
  static async generateRealEstateTrends(
    count: number = 10,
    retryCount = 0,
    seed: number = 0,
    userHistory?: string[]
  ): Promise<TrendData[]> {
    try {
      if (!GROK_API_KEY) {
        throw new Error("GROK_API_KEY environment variable is not set");
      }

      // Build historical context for better trend generation
      const historyContext =
        userHistory && userHistory.length > 0
          ? `\n\nUSER'S PREVIOUS TOPICS (avoid repeating these themes):\n${userHistory
              .slice(0, 10)
              .map((topic, i) => `${i + 1}. ${topic}`)
              .join("\n")}`
          : "";

      const prompt = `
You are a real estate market analyst with access to the latest trending data and current market conditions. Generate ${count} current, trending real estate topics for video content creation.

FOCUS ON CURRENT TRENDS (as of ${new Date().toLocaleDateString()}):
- Latest market movements and news
- Trending real estate topics on social media
- Current buyer/seller concerns and interests
- Recent policy changes affecting real estate
- Emerging market trends and opportunities
- Seasonal real estate patterns
- Technology trends in real estate
- Economic factors currently impacting the market

REQUIREMENTS:
1. Each topic should be CURRENT and TRENDING (not generic evergreen content)
2. Focus on what's happening RIGHT NOW in real estate
3. Include topics that are generating buzz in the industry
4. Consider seasonal factors and current market conditions
5. Make topics engaging for video content creation${historyContext}

For each trend, provide:
1. A catchy, current description (5-6 words max) - make it sound like breaking news
2. Key points (no more than 5 words) - focus on what's trending
3. Platform-specific captions that reflect current market sentiment:
   - Instagram: Engaging, emoji-rich, current trend-focused
   - Facebook: Informative, community-focused, trending topic
   - LinkedIn: Professional, industry insight, current market analysis
   - Twitter: Concise, trending hashtags, breaking news style
   - TikTok: Trendy, viral-worthy, current market buzz
   - YouTube: SEO-optimized, detailed, trending topic analysis

Return as valid JSON array:
[
  {
    "description": "Current trending topic description",
    "keypoints": "Key trending points",
    "instagram_caption": "Trending content with current hashtags",
    "facebook_caption": "Current market insight for community",
    "linkedin_caption": "Professional analysis of current trend",
    "twitter_caption": "Breaking news style with trending hashtags",
    "tiktok_caption": "Viral-worthy current trend content",
    "youtube_caption": "Detailed analysis of trending topic"
  }
]

Make sure all content reflects CURRENT TRENDS and what's happening in real estate RIGHT NOW.
`;

      const response = await axios.post<GrokResponse>(
        GROK_API_URL,
        {
          model: "grok-beta",
          messages: [
            {
              role: "system",
              content:
                "You are a real estate market analyst with access to the latest trending data. You provide current, trending real estate insights that are perfect for engaging video content. You always focus on what's happening RIGHT NOW in the market.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 2000,
          temperature: 0.8, // Higher temperature for more creative, trending content
        },
        {
          headers: {
            Authorization: `Bearer ${GROK_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content received from Grok");
      }

      // Clean and parse JSON response
      let cleanedContent = content.trim();

      // Remove markdown code blocks if present
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      // Remove any backticks
      cleanedContent = cleanedContent.replace(/`/g, "");

      console.log("Grok response:", cleanedContent);

      // Parse JSON response
      const trends = JSON.parse(cleanedContent) as TrendData[];

      // Validate trends
      if (!Array.isArray(trends) || trends.length === 0) {
        throw new Error("Invalid trends format from Grok");
      }

      // Validate each trend has required fields
      for (const trend of trends) {
        if (!trend.description || !trend.keypoints) {
          throw new Error("Invalid trend data from Grok");
        }
      }

      console.log(
        `✅ Generated ${trends.length} trending real estate topics using Grok`
      );
      return trends;
    } catch (error: any) {
      console.error("Error generating trends with Grok:", error);

      if (retryCount < 2) {
        console.log(
          `Retrying Grok trend generation (attempt ${retryCount + 1})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.generateRealEstateTrends(
          count,
          retryCount + 1,
          seed,
          userHistory
        );
      }

      // Fallback to basic trends if Grok fails
      return this.generateFallbackTrends(count);
    }
  }

  /**
   * Generate dynamic captions using Grok with trending context
   */
  static async generateDynamicCaptions(
    userId: string,
    videoData: {
      VIDEO_TOPIC: string;
      SCRIPT_HOOK: string;
      SCRIPT_SUMMARY: string;
      AGENT_NAME: string;
      AGENT_CITY: string;
      AGENT_EMAIL?: string;
      AGENT_PHONE?: string;
      AGENT_WEBSITE?: string;
      AGENT_SPECIALTY?: string;
    },
    userContext?: {
      name?: string;
      position?: string;
      companyName?: string;
      city?: string;
      socialHandles?: string;
      email?: string;
      phone?: string;
      website?: string;
      specialty?: string;
    },
    userHistory?: string[]
  ): Promise<{
    youtube_caption: string;
    instagram_caption: string;
    tiktok_caption: string;
    facebook_caption: string;
    linkedin_caption: string;
    twitter_caption: string;
  }> {
    try {
      if (!GROK_API_KEY) {
        throw new Error("GROK_API_KEY environment variable is not set");
      }

      // Build historical context
      const historyContext =
        userHistory && userHistory.length > 0
          ? `\n\nUSER'S RECENT TOPICS (ensure variety and avoid repetition):\n${userHistory
              .slice(0, 5)
              .map((topic, i) => `${i + 1}. ${topic}`)
              .join("\n")}`
          : "";

      const userContextText = userContext
        ? `\n\nUSER CONTEXT:
- Name: ${userContext.name || "Real Estate Professional"}
- Position: ${userContext.position || "Real Estate Professional"}
- Company: ${userContext.companyName || "Real Estate Company"}
- City: ${userContext.city || "Your City"}
- Email: ${userContext.email || "Not provided"}
- Phone: ${userContext.phone || "Not provided"}
- Website: ${userContext.website || "Not provided"}
- Specialty: ${userContext.specialty || "General Real Estate"}
- Social Handles: ${userContext.socialHandles || "Not provided"}`
        : "";

      const prompt = `
You are a real estate social media expert with access to the latest trending data and current market conditions. Create engaging, platform-optimized captions for a real estate video.

VIDEO CONTEXT:
- Topic: ${videoData.VIDEO_TOPIC}
- Script Hook: ${videoData.SCRIPT_HOOK}
- Script Summary: ${videoData.SCRIPT_SUMMARY}
- Agent: ${userContext?.name || "Real Estate Professional"} serving ${
        userContext?.city || "Your City"
      }${userContextText}${historyContext}

CURRENT TRENDING FOCUS:
- Use current trending hashtags and topics
- Reference latest market conditions and news
- Include seasonal trends and current buyer/seller concerns
- Make content feel fresh and current (not generic evergreen content)
- Use trending language and current market sentiment

PLATFORM REQUIREMENTS:
- YouTube: SEO-optimized, detailed, trending topic analysis, 300-500 words
- Instagram: Engaging, emoji-rich, current trend-focused, 150-300 words, 5-8 hashtags in caption, 20-25 in first comment
- TikTok: Viral-worthy, current market buzz, 100-150 chars MAX, 3-5 hashtags, always include #fyp
- Facebook: Community-focused, trending topic, 50-100 words, 2-3 emojis, 1-3 hashtags optional
- LinkedIn: Professional, current market analysis, 150-250 words, NO EMOJIS, 3-5 hashtags
- Twitter: Breaking news style, trending hashtags, 280 chars max, 3-5 hashtags

Return as JSON:
{
  "youtube_caption": "Detailed, SEO-optimized description with trending keywords",
  "instagram_caption": "Engaging caption with current trends and emojis",
  "tiktok_caption": "Viral-worthy short caption with trending hashtags",
  "facebook_caption": "Community-focused post about current trends",
  "linkedin_caption": "Professional analysis of current market trends",
  "twitter_caption": "Concise tweet about trending topic"
}

Make sure all content reflects CURRENT TRENDS and what's happening in real estate RIGHT NOW.
`;

      const response = await axios.post<GrokResponse>(
        GROK_API_URL,
        {
          model: "grok-beta",
          messages: [
            {
              role: "system",
              content:
                "You are a real estate social media expert with access to the latest trending data. You create engaging, current, trending content that drives high engagement. You always focus on what's happening RIGHT NOW in the market and use current trending hashtags and topics.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 2000,
          temperature: 0.8,
        },
        {
          headers: {
            Authorization: `Bearer ${GROK_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content received from Grok");
      }

      // Clean and parse JSON response
      let cleanedContent = content.trim();

      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      cleanedContent = cleanedContent.replace(/`/g, "");

      console.log("Grok captions response:", cleanedContent);

      const captions = JSON.parse(cleanedContent);

      // Validate captions
      const requiredFields = [
        "youtube_caption",
        "instagram_caption",
        "tiktok_caption",
        "facebook_caption",
        "linkedin_caption",
        "twitter_caption",
      ];
      for (const field of requiredFields) {
        if (!captions[field]) {
          throw new Error(`Missing ${field} in Grok response`);
        }
      }

      console.log(
        `✅ Generated trending captions using Grok for user ${userId}`
      );
      return captions;
    } catch (error: any) {
      console.error("Error generating captions with Grok:", error);

      // Fallback to basic captions
      return this.generateFallbackCaptions(
        videoData.VIDEO_TOPIC,
        videoData.SCRIPT_SUMMARY
      );
    }
  }

  /**
   * Get user's topic history for better trend generation
   */
  static async getUserTopicHistory(
    userId: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      // Import the UserPostHistory model
      const UserPostHistory = require("../models/UserPostHistory").default;

      const history = await UserPostHistory.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("videoTopic")
        .lean();

      return history.map((item: any) => item.videoTopic);
    } catch (error) {
      console.error("Error getting user topic history:", error);
      return [];
    }
  }

  /**
   * Generate fallback trends if Grok fails
   */
  private static generateFallbackTrends(count: number): TrendData[] {
    const fallbackTrends: TrendData[] = [
      {
        description: "Market Update Today",
        keypoints: "Current rates, prices, trends",
        instagram_caption:
          "📈 Today's real estate market update! Current trends and what it means for you 🏠 #RealEstate #MarketUpdate",
        facebook_caption:
          "Real estate market update for today. Here's what's happening with rates, prices, and trends in your area.",
        linkedin_caption:
          "Professional analysis of today's real estate market conditions and trends affecting buyers and sellers.",
        twitter_caption:
          "Today's real estate market update 📈 #RealEstate #MarketTrends",
        tiktok_caption:
          "Today's market update 📈 #RealEstate #MarketTrends #fyp",
        youtube_caption:
          "Real Estate Market Update - Today's Analysis of Current Trends, Rates, and Market Conditions",
      },
    ];

    return fallbackTrends.slice(0, count);
  }

  /**
   * Generate fallback captions if Grok fails
   */
  private static generateFallbackCaptions(
    topic: string,
    keyPoints: string
  ): {
    youtube_caption: string;
    instagram_caption: string;
    tiktok_caption: string;
    facebook_caption: string;
    linkedin_caption: string;
    twitter_caption: string;
  } {
    return {
      youtube_caption: `Real Estate Insights: ${topic} - ${keyPoints}. Stay informed about current market trends and opportunities.`,
      instagram_caption: `🏠 ${topic} - ${keyPoints} #RealEstate #Property #Home`,
      tiktok_caption: `${topic} 🏠 #RealEstate #Property #fyp`,
      facebook_caption: `${topic}: ${keyPoints}. Contact us for more information about real estate opportunities.`,
      linkedin_caption: `Professional insight: ${topic}. ${keyPoints}. Let's connect to discuss real estate opportunities.`,
      twitter_caption: `${topic}: ${keyPoints} #RealEstate #Property`,
    };
  }
}

export default GrokGenerationService;
