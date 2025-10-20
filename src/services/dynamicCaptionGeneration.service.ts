import axios from "axios";
import DynamicPostGenerationService, {
  VideoData,
  PostGenerationResult,
} from "./dynamicPostGeneration.service";
import TemplateLibraryService from "./templateLibrary.service";
import CaptionGenerationService, {
  SocialMediaCaptions,
} from "./captionGeneration.service";
import GrokGenerationService from "./grokGeneration.service";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface DynamicSocialMediaCaptions extends SocialMediaCaptions {
  youtube_caption: string;
}

export interface UserContext {
  name?: string;
  position?: string;
  companyName?: string;
  city?: string;
  socialHandles?: string;
  email?: string;
  phone?: string;
  website?: string;
  specialty?: string;
}

export class DynamicCaptionGenerationService {
  /**
   * Generate dynamic, platform-optimized captions using Grok with trending data
   */
  static async generateDynamicCaptions(
    userId: string,
    videoData: VideoData,
    userContext?: UserContext
  ): Promise<DynamicSocialMediaCaptions> {
    try {
      console.log(
        `🚀 Generating dynamic captions using Grok for user ${userId}`
      );

      // Get user's topic history for better context
      const userHistory = await GrokGenerationService.getUserTopicHistory(
        userId,
        10
      );

      // Use Grok for trending, current captions
      const captions = await GrokGenerationService.generateDynamicCaptions(
        userId,
        videoData,
        userContext,
        userHistory
      );

      console.log(
        `✅ Generated trending captions using Grok for user ${userId}`
      );
      return captions;
    } catch (error) {
      console.error("Error generating captions with Grok:", error);

      // Fallback to our dynamic system
      try {
        const platforms = [
          "youtube",
          "instagram",
          "tiktok",
          "facebook",
          "linkedin",
        ];
        const results: { [key: string]: PostGenerationResult } = {};

        // Generate posts for each platform using our dynamic system
        for (const platform of platforms) {
          try {
            const result = await this.generatePostForPlatform(
              userId,
              platform,
              videoData,
              userContext
            );
            results[platform] = result;
          } catch (error) {
            console.error(`Error generating post for ${platform}:`, error);
            // Fallback to basic caption generation
            results[platform] = await this.generateFallbackPost(
              platform,
              videoData,
              userContext
            );
          }
        }

        // Convert results to the expected format
        const captions: DynamicSocialMediaCaptions = {
          youtube_caption: results.youtube?.content?.caption || "",
          instagram_caption: results.instagram?.content?.caption || "",
          tiktok_caption: results.tiktok?.content?.caption || "",
          facebook_caption: results.facebook?.content?.caption || "",
          linkedin_caption: results.linkedin?.content?.caption || "",
          twitter_caption: results.linkedin?.content?.caption || "", // Use LinkedIn for Twitter as fallback
        };

        return captions;
      } catch (fallbackError) {
        console.error("Error in fallback dynamic captions:", fallbackError);
        // Final fallback to existing caption generation service
        return this.generateFallbackCaptions(
          videoData.VIDEO_TOPIC,
          videoData.SCRIPT_SUMMARY,
          userContext
        );
      }
    }
  }

  /**
   * Generate a single post for a specific platform using our dynamic system
   */
  private static async generatePostForPlatform(
    userId: string,
    platform: string,
    videoData: VideoData,
    userContext?: UserContext
  ): Promise<PostGenerationResult> {
    try {
      // 1. Get user's post history for this platform
      const postHistory = await DynamicPostGenerationService.getPostHistory(
        userId,
        platform,
        10
      );
      const postCount = postHistory.length;

      // 2. Classify video topic
      const topicCategory = DynamicPostGenerationService.classifyTopic(
        videoData.VIDEO_TOPIC
      );

      // 3. Get recent selections to avoid repetition
      const recentVariants =
        await DynamicPostGenerationService.getRecentVariants(
          userId,
          platform,
          2
        );
      const recentTones = await DynamicPostGenerationService.getRecentTones(
        userId,
        platform,
        2
      );
      const recentHooks = await DynamicPostGenerationService.getRecentHooks(
        userId,
        platform,
        3
      );
      const lastCTA = await DynamicPostGenerationService.getLastCTA(
        userId,
        platform
      );
      const recentOpenings =
        await DynamicPostGenerationService.getRecentOpenings(
          userId,
          platform,
          3
        );
      const recentCTAs = await DynamicPostGenerationService.getRecentCTAs(
        userId,
        platform,
        2
      );

      // 4. Select template variant, tone, hook, and CTA
      const templateVariant =
        DynamicPostGenerationService.selectTemplateVariant(
          postCount,
          topicCategory,
          recentVariants
        );
      const selectedTone = DynamicPostGenerationService.selectTone(
        platform,
        recentTones
      );
      const selectedHook =
        DynamicPostGenerationService.selectHookType(recentHooks);
      const selectedCTA = DynamicPostGenerationService.selectCTAType(lastCTA);

      // 5. Get template structure
      const templateStructure = TemplateLibraryService.getTemplateStructure(
        platform,
        templateVariant
      );

      // 6. Build dynamic prompt
      const prompt = this.buildDynamicPrompt({
        platform,
        templateStructure,
        templateVariant,
        topicCategory,
        selectedTone,
        selectedHook,
        selectedCTA,
        videoData,
        userContext,
        recentOpenings,
        recentCTAs,
      });

      // 7. Call OpenAI API
      const generatedContent = await this.callOpenAI(prompt, {
        temperature: 0.75,
        max_tokens: 1500,
      });

      // 8. Parse and structure response
      const parsedContent = this.parseGeneratedContent(
        generatedContent,
        platform
      );

      // 9. Extract metadata for tracking
      const metadata = {
        templateVariant,
        topicCategory,
        toneUsed: selectedTone,
        hookType: selectedHook,
        ctaType: selectedCTA,
        structuralFormat: `${selectedHook}_${selectedTone}_${selectedCTA}`,
        openingSentence: DynamicPostGenerationService.extractFirstSentence(
          parsedContent.caption
        ),
        ctaText: DynamicPostGenerationService.extractCTA(parsedContent.caption),
        fullCaption: parsedContent.caption,
      };

      // 10. Save to post history
      const postId = await DynamicPostGenerationService.savePostMetadata(
        userId,
        platform,
        {
          videoTopic: videoData.VIDEO_TOPIC,
          ...metadata,
        }
      );

      return {
        success: true,
        postId,
        platform,
        content: parsedContent,
        metadata,
      };
    } catch (error) {
      console.error(`Error generating post for ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Build the complete dynamic prompt for AI generation
   */
  private static buildDynamicPrompt({
    platform,
    templateStructure,
    templateVariant,
    topicCategory,
    selectedTone,
    selectedHook,
    selectedCTA,
    videoData,
    userContext,
    recentOpenings,
    recentCTAs,
  }: {
    platform: string;
    templateStructure: any;
    templateVariant: number;
    topicCategory: string;
    selectedTone: string;
    selectedHook: string;
    selectedCTA: string;
    videoData: VideoData;
    userContext?: UserContext;
    recentOpenings: string[];
    recentCTAs: string[];
  }): string {
    const userContextText = userContext
      ? `\n\nUSER CONTEXT:
- Name: ${userContext.name || "Not provided"}
- Position: ${userContext.position || "Real Estate Professional"}
- Company: ${userContext.companyName || "Not provided"}
- City: ${userContext.city || "Not provided"}
- Email: ${userContext.email || "Not provided"}
- Phone: ${userContext.phone || "Not provided"}
- Website: ${userContext.website || "Not provided"}
- Specialty: ${userContext.specialty || "General Real Estate"}
- Social Handles: ${userContext.socialHandles || "Not provided"}`
      : "";

    return `You are an expert social media copywriter specializing in real estate content for ${platform}.

VIDEO CONTEXT:
- Topic: ${videoData.VIDEO_TOPIC}
- Script Hook: ${videoData.SCRIPT_HOOK}
- Script Summary: ${videoData.SCRIPT_SUMMARY}
- Agent: ${userContext?.name || "Real Estate Professional"} serving ${
      userContext?.city || "Your City"
    }${userContextText}

TEMPLATE TO USE:
${templateStructure.structure}

VARIATION REQUIREMENTS (CRITICAL - MUST FOLLOW):
- Template Variant: #${templateVariant} of 5
- Topic Category: ${topicCategory}
- Tone: ${selectedTone}
- Opening Hook Type: ${selectedHook}
- CTA Type: ${selectedCTA}

ANTI-REPETITION RULES:
You MUST avoid similarity to these recent posts:
Recent opening sentences (DO NOT repeat similar structure or words):
${recentOpenings.map((opening, i) => `${i + 1}. "${opening}"`).join("\n")}

Recent CTAs (make yours distinctly different):
${recentCTAs.map((cta, i) => `${i + 1}. "${cta}"`).join("\n")}

CRITICAL INSTRUCTIONS:
1. Write in ${selectedTone} tone appropriate for ${platform}
2. Use ${selectedHook} style for opening (question, bold statement, story, data, or provocative)
3. Vary sentence structure and rhythm from recent posts
4. CTA must be ${selectedCTA}-style and feel fresh
5. Make it authentic to ${platform} culture, not templated or robotic
6. Reference ${videoData.VIDEO_TOPIC} naturally throughout
7. Keep it natural and conversational - this should sound human

Platform-Specific Guidelines: ${TemplateLibraryService.getPlatformGuidelines(
      platform
    )}

Generate the post now, following the template structure and variation requirements.`;
  }

  /**
   * Call OpenAI API with the dynamic prompt
   */
  private static async callOpenAI(
    prompt: string,
    options: { temperature: number; max_tokens: number }
  ): Promise<string> {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const response = await axios.post<OpenAIResponse>(
      OPENAI_API_URL,
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert social media copywriter specializing in real estate content. You write authentic, engaging posts that follow platform best practices and avoid repetitive patterns.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: options.temperature,
        max_tokens: options.max_tokens,
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
      throw new Error("No content received from OpenAI");
    }

    return content;
  }

  /**
   * Parse generated content based on platform
   */
  private static parseGeneratedContent(
    content: string,
    platform: string
  ): {
    caption: string;
    hashtags: string[];
    title?: string;
    description?: string;
  } {
    // Extract hashtags
    const hashtags = DynamicPostGenerationService.extractHashtags(content);

    // Platform-specific parsing
    if (platform === "youtube") {
      // For YouTube, extract title and description
      const lines = content.split("\n");
      const title =
        lines
          .find((line) => line.includes("[TITLE"))
          ?.replace(/\[TITLE[^\]]*\]/g, "")
          .trim() || "";
      const description = content.replace(/\[TITLE[^\]]*\]/g, "").trim();

      return {
        caption: description,
        hashtags,
        title,
        description,
      };
    }

    // For other platforms, return the content as caption
    return {
      caption: content,
      hashtags,
    };
  }

  /**
   * Generate fallback post if dynamic generation fails
   */
  private static async generateFallbackPost(
    platform: string,
    videoData: VideoData,
    userContext?: UserContext
  ): Promise<PostGenerationResult> {
    const fallbackCaptions = await this.generateFallbackCaptions(
      videoData.VIDEO_TOPIC,
      videoData.SCRIPT_SUMMARY,
      userContext
    );

    const platformKey =
      `${platform}_caption` as keyof DynamicSocialMediaCaptions;
    const caption =
      fallbackCaptions[platformKey] || fallbackCaptions.instagram_caption;

    return {
      success: false,
      platform,
      content: {
        caption,
        hashtags: DynamicPostGenerationService.extractHashtags(caption),
      },
      metadata: {
        templateVariant: 1,
        topicCategory: "industry_analysis",
        toneUsed: "conversational",
        hookType: "question",
        ctaType: "action",
        structuralFormat: "fallback",
        openingSentence:
          DynamicPostGenerationService.extractFirstSentence(caption),
        ctaText: DynamicPostGenerationService.extractCTA(caption),
      },
      error: "Fallback caption generated",
    };
  }

  /**
   * Generate fallback captions using existing service
   */
  private static async generateFallbackCaptions(
    topic: string,
    keyPoints: string,
    userContext?: UserContext
  ): Promise<DynamicSocialMediaCaptions> {
    try {
      const captions = await CaptionGenerationService.generateCaptions(
        topic,
        keyPoints,
        userContext
      );

      // Add YouTube caption (use LinkedIn as base)
      const youtubeCaption = captions.linkedin_caption.replace(
        /#RealEstate #PropertyInvestment #MarketTrends #BusinessGrowth #ProfessionalNetworking #IndustryInsights #PropertyManagement #RealEstateInvestment/g,
        "#RealEstate #PropertyInvestment #MarketTrends #RealEstateTips #PropertyInvestment #HomeBuying #RealEstateAgent #PropertyManagement #RealEstateInvestment #PropertyInvestment #RealEstateMarket #PropertyTrends #RealEstateNews #PropertyInvestment #RealEstateAdvice"
      );

      return {
        ...captions,
        youtube_caption: youtubeCaption,
      };
    } catch (error) {
      console.error("Error generating fallback captions:", error);

      // Ultimate fallback
      return {
        youtube_caption: `🏠 ${topic} - ${keyPoints} #RealEstate #Property #Home #Investment`,
        instagram_caption: `🏠 ${topic} - ${keyPoints} #RealEstate #Property #Home`,
        facebook_caption: `${topic}: ${keyPoints}. Contact us for more information about real estate opportunities.`,
        linkedin_caption: `Professional insight: ${topic}. ${keyPoints}. Let's connect to discuss real estate opportunities.`,
        twitter_caption: `${topic}: ${keyPoints} #RealEstate #Property`,
        tiktok_caption: `POV: You need to know about ${topic} 🏠 #RealEstate #Property #FYP`,
      };
    }
  }

  /**
   * Generate captions for scheduled video (replaces existing method)
   */
  static async generateScheduledVideoCaptions(
    description: string,
    keypoints: string,
    userId: string,
    userContext?: UserContext
  ): Promise<DynamicSocialMediaCaptions> {
    const videoData: VideoData = {
      VIDEO_TOPIC: description,
      SCRIPT_HOOK: description,
      SCRIPT_SUMMARY: keypoints,
      AGENT_NAME: userContext?.name || "Real Estate Professional",
      AGENT_CITY: userContext?.city || "Your City",
      AGENT_EMAIL: userContext?.email,
      AGENT_PHONE: userContext?.phone,
      AGENT_WEBSITE: userContext?.website,
      AGENT_SPECIALTY: userContext?.specialty,
    };

    return this.generateDynamicCaptions(userId, videoData, userContext);
  }

  /**
   * Generate captions for custom video (replaces existing method)
   */
  static async generateCustomVideoCaptions(
    hook: string,
    body: string,
    conclusion: string,
    userId: string,
    userContext?: UserContext
  ): Promise<DynamicSocialMediaCaptions> {
    const videoData: VideoData = {
      VIDEO_TOPIC: hook,
      SCRIPT_HOOK: hook,
      SCRIPT_SUMMARY: `${body} ${conclusion}`.trim(),
      AGENT_NAME: userContext?.name || "Real Estate Professional",
      AGENT_CITY: userContext?.city || "Your City",
      AGENT_EMAIL: userContext?.email,
      AGENT_PHONE: userContext?.phone,
      AGENT_WEBSITE: userContext?.website,
      AGENT_SPECIALTY: userContext?.specialty,
    };

    return this.generateDynamicCaptions(userId, videoData, userContext);
  }
}

export default DynamicCaptionGenerationService;
