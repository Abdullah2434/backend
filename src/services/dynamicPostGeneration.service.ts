import ContentTemplate from "../models/ContentTemplate";
import UserPostHistory from "../models/UserPostHistory";
import {
  UserContext,
  TopicAnalysis,
  GeneratedPost,
} from "../types/services/dynamicPostGeneration.types";
import {
  DEFAULT_PLATFORMS,
  POST_HISTORY_LIMIT,
} from "../constants/dynamicPostGeneration.constants";
import {
  analyzeTopic,
  analyzePostPatterns,
  selectTemplateVariant,
  selectHookType,
  selectTone,
  selectCtaType,
  extractMetadata,
  extractHashtags,
  extractCTA,
  parseContentStructure,
  cleanQuotationMarks,
  getOpeningSentence,
} from "../utils/dynamicPostGenerationHelpers";
import {
  getPlatformGuidelines,
  getTemplateStructure,
} from "../utils/dynamicPostGenerationPlatformHelpers";
import { generateContentWithOpenAI } from "../utils/dynamicPostGenerationAIHelpers";
import {
  buildEnhancedMemoryContext,
  buildGenerationPrompt,
  buildSystemMessage,
} from "../prompts/dynamicPostGeneration.prompts";

export class DynamicPostGenerationService {
  /**
   * Generate dynamic multi-platform posts with Smart Memory System
   */
  static async generateDynamicPosts(
    topic: string,
    keyPoints: string,
    userContext: UserContext,
    userId: string,
    platforms: string[] = [...DEFAULT_PLATFORMS]
  ): Promise<GeneratedPost[]> {
    // Step 1: Analyze topic
    const topicAnalysis = analyzeTopic(topic, keyPoints);

    // Step 2: Get user's post history for each platform
    const userHistory = await this.getUserPostHistory(userId, platforms);

    // Step 3: Generate posts for each platform
    const generatedPosts: GeneratedPost[] = [];

    for (const platform of platforms) {
      try {
        const post = await this.generatePlatformPost(
          platform,
          topicAnalysis,
          userContext,
          userHistory[platform] || [],
          userId
        );
        generatedPosts.push(post);
      } catch (error) {
        // Continue with other platforms
      }
    }

    return generatedPosts;
  }

  /**
   * Get user's post history for Smart Memory System
   */
  private static async getUserPostHistory(
    userId: string,
    platforms: string[]
  ): Promise<{ [platform: string]: any[] }> {
    const history: { [platform: string]: any[] } = {};

    for (const platform of platforms) {
      try {
        const posts = await UserPostHistory.find({
          userId,
          platform: platform as any,
        })
          .sort({ createdAt: -1 })
          .limit(POST_HISTORY_LIMIT)
          .lean();

        history[platform] = posts;
      } catch (error) {
        history[platform] = [];
      }
    }

    return history;
  }

  /**
   * Generate a post for a specific platform using Template Rotation Engine
   */
  private static async generatePlatformPost(
    platform: string,
    topicAnalysis: TopicAnalysis,
    userContext: UserContext,
    userHistory: any[],
    userId: string
  ): Promise<GeneratedPost> {
    // Step 1: Get available templates
    const availableTemplates = await ContentTemplate.find({
      platform: platform as any,
      isActive: true,
    }).select("variant");

    const availableVariants = availableTemplates.map((t: any) => t.variant);

    // Step 2: Select template variant (avoid recent ones)
    const templateVariant = selectTemplateVariant(
      availableVariants,
      userHistory
    );

    // Step 3: Get template
    const template = await ContentTemplate.findOne({
      platform: platform as any,
      variant: templateVariant,
      isActive: true,
    });

    if (!template) {
      // Return a fallback post with basic content
      const fallbackContent = `${
        topicAnalysis.topic
      } - ${topicAnalysis.keyPoints.join(", ")}`;
      return {
        platform,
        content: fallbackContent,
        templateVariant: 0,
        hookType: "direct",
        tone: "professional",
        ctaType: "contact",
        hashtags: [],
        metadata: {
          characterCount: fallbackContent.length,
          hashtagCount: 0,
          emojiCount: 0,
          isFallback: true,
          reason: "No template found",
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Step 4: Select content variations
    const hookType = selectHookType(template.structure.hook.type, userHistory);
    const tone = selectTone(template.tone, topicAnalysis, userHistory);
    const ctaType = selectCtaType(
      template.structure.conclusion.ctaType,
      userHistory
    );

    // Step 5: Generate content using AI
    const content = await this.generateContentWithAI(
      topicAnalysis,
      userContext,
      template,
      hookType,
      tone,
      ctaType,
      platform,
      userHistory
    );

    // Step 6: Extract metadata
    const metadata = extractMetadata(content);

    // Step 7: Save to history
    await this.saveToHistory(
      userId,
      platform,
      topicAnalysis,
      templateVariant,
      hookType,
      tone,
      ctaType,
      content,
      metadata
    );

    return {
      platform,
      content,
      templateVariant,
      hookType,
      tone,
      ctaType,
      hashtags: extractHashtags(content),
      metadata,
    };
  }

  /**
   * Generate content using AI with Smart Memory System
   */
  private static async generateContentWithAI(
    topicAnalysis: TopicAnalysis,
    userContext: UserContext,
    template: any,
    hookType: string,
    tone: string,
    ctaType: string,
    platform: string,
    userHistory: any[] = []
  ): Promise<string> {
    // Build memory context
    const patterns = analyzePostPatterns(userHistory);
    const memoryContext = buildEnhancedMemoryContext(
      topicAnalysis,
      userContext,
      patterns
    );

    // Get platform-specific guidelines
    const platformGuidelines = getPlatformGuidelines(platform);

    // Get template structure
    const templateStructure = getTemplateStructure(template, platform);

    // Build prompt
    const prompt = buildGenerationPrompt(
      platform,
      topicAnalysis,
      userContext,
      templateStructure,
      template.variant,
      tone,
      hookType,
      ctaType,
      memoryContext,
      platformGuidelines
    );

    // Build system message
    const systemMessage = buildSystemMessage(platform);

    // Generate content
    const aiResponse = await generateContentWithOpenAI(prompt, systemMessage);

    // Clean quotation marks from AI response
    return cleanQuotationMarks(aiResponse);
  }

  /**
   * Save post to history for Smart Memory System
   */
  private static async saveToHistory(
    userId: string,
    platform: string,
    topicAnalysis: TopicAnalysis,
    templateVariant: number,
    hookType: string,
    tone: string,
    ctaType: string,
    content: string,
    metadata: any
  ): Promise<void> {
    const postHistory = new UserPostHistory({
      userId,
      platform: platform as any,
      topic: topicAnalysis.topic,
      topicType: topicAnalysis.topicType,
      templateVariant,
      hookType,
      tone,
      ctaType,
      openingSentence: getOpeningSentence(content),
      cta: extractCTA(content),
      hashtags: extractHashtags(content),
      contentStructure: parseContentStructure(content),
      metadata,
    });

    await postHistory.save();
  }
}
