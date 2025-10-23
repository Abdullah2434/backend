import PostHistory, { IPostHistory } from "../models/PostHistory";
import UserContentProfile, {
  IUserContentProfile,
} from "../models/UserContentProfile";
import ContentTemplate, { IContentTemplate } from "../models/ContentTemplate";
import axios from "axios";

export interface ContentGenerationRequest {
  userId: string;
  platform: string;
  topicType: string;
  videoTitle: string;
  videoDescription: string;
  agentInfo: {
    name: string;
    location: string;
    specialty: string;
  };
  videoId?: string;
  scheduleId?: string;
  trendIndex?: number;
}

export interface GeneratedContent {
  platform: string;
  content: string;
  templateUsed: string;
  hookType: string;
  toneStyle: string;
  ctaType: string;
  topicType: string;
  metadata: {
    characterCount: number;
    hashtagCount: number;
    mentionCount: number;
    linkCount: number;
  };
}

class DynamicContentGenerationService {
  /**
   * Generate dynamic content for a specific platform
   */
  async generateContent(
    request: ContentGenerationRequest
  ): Promise<GeneratedContent> {
    const {
      userId,
      platform,
      topicType,
      videoTitle,
      videoDescription,
      agentInfo,
    } = request;

    // 1. Get user's content profile
    const userProfile = await this.getOrCreateUserProfile(userId, platform);

    // 2. Get recent post history to avoid repetition
    const recentPosts = await this.getRecentPosts(userId, platform, 10);

    // 3. Select optimal template based on anti-repetition rules
    const selectedTemplate = await this.selectOptimalTemplate(
      platform,
      topicType,
      userProfile,
      recentPosts
    );

    // 4. Generate content using selected template
    const content = await this.generateContentFromTemplate(
      selectedTemplate,
      videoTitle,
      videoDescription,
      agentInfo,
      topicType
    );

    // 5. Store the generated content in history
    await this.storePostHistory({
      userId,
      platform,
      templateUsed: selectedTemplate.id,
      hookType: selectedTemplate.hookType,
      toneStyle: selectedTemplate.toneStyle,
      ctaType: selectedTemplate.ctaType,
      content: content.content,
      topicType,
      videoId: request.videoId,
      scheduleId: request.scheduleId,
      trendIndex: request.trendIndex,
    });

    // 6. Update user profile
    await this.updateUserProfile(userId, platform, selectedTemplate.id);

    return content;
  }

  /**
   * Get or create user content profile
   */
  private async getOrCreateUserProfile(
    userId: string,
    platform: string
  ): Promise<IUserContentProfile> {
    let profile = await UserContentProfile.findOne({ userId, platform });

    if (!profile) {
      profile = new UserContentProfile({
        userId,
        platform,
        lastUsedTemplates: [],
        preferredHooks: ["question", "bold_statement", "data"],
        contentStyle: "professional",
        totalPosts: 0,
        lastPostDate: new Date(),
        averageEngagement: 0,
      });
      await profile.save();
    }

    return profile;
  }

  /**
   * Get recent posts to avoid repetition
   */
  private async getRecentPosts(
    userId: string,
    platform: string,
    limit: number
  ): Promise<IPostHistory[]> {
    return await PostHistory.find({ userId, platform })
      .sort({ postedAt: -1 })
      .limit(limit);
  }

  /**
   * Select optimal template based on anti-repetition rules
   */
  private async selectOptimalTemplate(
    platform: string,
    topicType: string,
    userProfile: IUserContentProfile,
    recentPosts: IPostHistory[]
  ): Promise<IContentTemplate> {
    // Get all available templates for the platform
    const availableTemplates = await ContentTemplate.find({
      platform,
      isActive: true,
    });

    // Filter out recently used templates (anti-repetition rule)
    const recentlyUsedTemplates = recentPosts
      .slice(0, 2)
      .map((post) => post.templateUsed);
    const filteredTemplates = availableTemplates.filter(
      (template) => !recentlyUsedTemplates.includes(template.id)
    );

    // If all templates were used recently, use the least recently used
    const templatesToUse =
      filteredTemplates.length > 0 ? filteredTemplates : availableTemplates;

    // Select template based on topic type and user preferences
    const optimalTemplate = this.selectTemplateByTopicAndPreferences(
      templatesToUse,
      topicType,
      userProfile
    );

    return optimalTemplate;
  }

  /**
   * Select template based on topic type and user preferences
   */
  private selectTemplateByTopicAndPreferences(
    templates: IContentTemplate[],
    topicType: string,
    userProfile: IUserContentProfile
  ): IContentTemplate {
    // Topic-based template selection rules
    const topicPreferences: { [key: string]: string[] } = {
      market_update: ["data", "bold_statement"],
      tips: ["question", "story"],
      local_news: ["story", "data"],
      industry_analysis: ["bold_statement", "provocative"],
      general: ["question", "story", "data"],
    };

    const preferredHooks = topicPreferences[topicType] || ["question", "data"];

    // Filter templates by preferred hooks
    const hookFilteredTemplates = templates.filter((template) =>
      preferredHooks.includes(template.hookType)
    );

    // If no templates match preferred hooks, use all templates
    const templatesToChooseFrom =
      hookFilteredTemplates.length > 0 ? hookFilteredTemplates : templates;

    // Select template with highest success rate
    const sortedTemplates = templatesToChooseFrom.sort(
      (a, b) => b.successRate - a.successRate
    );

    return sortedTemplates[0] || templates[0];
  }

  /**
   * Generate content from template
   */
  private async generateContentFromTemplate(
    template: IContentTemplate,
    videoTitle: string,
    videoDescription: string,
    agentInfo: any,
    topicType: string
  ): Promise<GeneratedContent> {
    // Replace template placeholders with actual content
    let content = template.template
      .replace("{VIDEO_TITLE}", videoTitle)
      .replace("{VIDEO_DESCRIPTION}", videoDescription)
      .replace("{AGENT_NAME}", agentInfo.name)
      .replace("{LOCATION}", agentInfo.location)
      .replace("{SPECIALTY}", agentInfo.specialty);

    // Platform-specific optimizations
    content = this.optimizeForPlatform(content, template.platform);

    // Enhance content with Grok AI for more intelligent and engaging posts
    content = await this.enhanceContentWithGrok(
      content,
      template.platform,
      topicType,
      agentInfo
    );

    // Calculate metadata
    const metadata = this.calculateContentMetadata(content);

    return {
      platform: template.platform,
      content,
      templateUsed: template.id,
      hookType: template.hookType,
      toneStyle: template.toneStyle,
      ctaType: template.ctaType,
      topicType,
      metadata,
    };
  }

  /**
   * Optimize content for specific platform
   */
  private optimizeForPlatform(content: string, platform: string): string {
    switch (platform) {
      case "youtube":
        // YouTube: Educational, comprehensive descriptions
        return this.optimizeForYouTube(content);
      case "instagram":
        // Instagram: Visual-first, hashtag-optimized captions
        return this.optimizeForInstagram(content);
      case "tiktok":
        // TikTok: Ultra-short, scroll-stopping content
        return this.optimizeForTikTok(content);
      case "facebook":
        // Facebook: Community-focused, conversational posts
        return this.optimizeForFacebook(content);
      case "linkedin":
        // LinkedIn: Professional, thought-leadership content
        return this.optimizeForLinkedIn(content);
      default:
        return content;
    }
  }

  /**
   * YouTube optimization
   */
  private optimizeForYouTube(content: string): string {
    // Add educational elements
    if (!content.includes("?")) {
      content += " What questions do you have about this topic?";
    }
    return content;
  }

  /**
   * Instagram optimization
   */
  private optimizeForInstagram(content: string): string {
    // Add relevant hashtags
    const hashtags = this.generateInstagramHashtags(content);
    return `${content}\n\n${hashtags}`;
  }

  /**
   * TikTok optimization
   */
  private optimizeForTikTok(content: string): string {
    // Keep it short and punchy
    if (content.length > 150) {
      content = content.substring(0, 147) + "...";
    }
    return content;
  }

  /**
   * Facebook optimization
   */
  private optimizeForFacebook(content: string): string {
    // Add community-focused elements
    if (!content.includes("community") && !content.includes("neighbors")) {
      content += " What are your thoughts on this?";
    }
    return content;
  }

  /**
   * LinkedIn optimization
   */
  private optimizeForLinkedIn(content: string): string {
    // Add professional elements
    if (!content.includes("industry") && !content.includes("market")) {
      content += " How does this impact the real estate industry?";
    }
    return content;
  }

  /**
   * Generate Instagram hashtags
   */
  private generateInstagramHashtags(content: string): string {
    const hashtags = [
      "#realestate",
      "#realestatetips",
      "#homebuying",
      "#realestateagent",
      "#property",
      "#housingmarket",
      "#realestateinvesting",
      "#homeownership",
    ];

    return hashtags.join(" ");
  }

  /**
   * Calculate content metadata
   */
  private calculateContentMetadata(content: string) {
    return {
      characterCount: content.length,
      hashtagCount: (content.match(/#/g) || []).length,
      mentionCount: (content.match(/@/g) || []).length,
      linkCount: (content.match(/https?:\/\//g) || []).length,
    };
  }

  /**
   * Store post history
   */
  private async storePostHistory(postData: any): Promise<void> {
    const postHistory = new PostHistory(postData);
    await postHistory.save();
  }

  /**
   * Update user profile
   */
  private async updateUserProfile(
    userId: string,
    platform: string,
    templateId: string
  ): Promise<void> {
    await UserContentProfile.findOneAndUpdate(
      { userId, platform },
      {
        $push: { lastUsedTemplates: { $each: [templateId], $slice: -10 } },
        $inc: { totalPosts: 1 },
        $set: { lastPostDate: new Date() },
      },
      { upsert: true }
    );
  }

  /**
   * Generate content for all platforms
   */
  async generateMultiPlatformContent(
    request: Omit<ContentGenerationRequest, "platform">
  ): Promise<GeneratedContent[]> {
    const platforms = [
      "youtube",
      "instagram",
      "tiktok",
      "facebook",
      "linkedin",
    ];
    const results: GeneratedContent[] = [];

    for (const platform of platforms) {
      const platformRequest = { ...request, platform };
      const content = await this.generateContent(platformRequest);
      results.push(content);
    }

    return results;
  }

  /**
   * Enhance content using Grok AI for more intelligent and engaging posts
   */
  private async enhanceContentWithGrok(
    content: string,
    platform: string,
    topicType: string,
    agentInfo: any
  ): Promise<string> {
    try {
      const grokApiKey = process.env.GROK_API_KEY;
      if (!grokApiKey) {
        console.log("⚠️ Grok API key not configured, using template content");
        return content;
      }

      const prompt = this.buildGrokPrompt(
        content,
        platform,
        topicType,
        agentInfo
      );

      const response = await axios.post(
        "https://api.x.ai/v1/chat/completions",
        {
          model: "grok-3",
          messages: [
            {
              role: "system",
              content:
                "You are an expert social media content creator specializing in real estate. Create engaging, platform-optimized content that drives engagement and builds trust with potential clients.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${grokApiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const enhancedContent = response.data.choices[0]?.message?.content;
      if (enhancedContent && enhancedContent.trim()) {
        console.log(`🤖 Grok enhanced content for ${platform}`);
        return enhancedContent.trim();
      }

      return content;
    } catch (error) {
      console.error("❌ Error enhancing content with Grok:", error);
      return content; // Fallback to original content
    }
  }

  /**
   * Build prompt for Grok AI enhancement
   */
  private buildGrokPrompt(
    content: string,
    platform: string,
    topicType: string,
    agentInfo: any
  ): string {
    const platformGuidelines: { [key: string]: string } = {
      youtube:
        "Educational, comprehensive, 200-300 words, include questions for engagement",
      instagram:
        "Visual-first, hashtag-optimized, 150-200 words, use emojis strategically",
      tiktok:
        "Ultra-short, scroll-stopping, 50-100 words, high energy, trending language",
      facebook:
        "Community-focused, conversational, 100-150 words, local perspective",
      linkedin:
        "Professional, thought-leadership, 150-200 words, industry insights",
    };

    return `
Enhance this real estate social media post for ${platform}:

ORIGINAL CONTENT:
${content}

REQUIREMENTS:
- Platform: ${platform} (${platformGuidelines[platform]})
- Topic Type: ${topicType}
- Agent: ${agentInfo.name} (${agentInfo.specialty}) in ${agentInfo.location}
- Make it more engaging, authentic, and platform-optimized
- Keep the core message but improve the hook, tone, and call-to-action
- Ensure it feels personal and builds trust with potential clients

Generate an enhanced version that will drive more engagement and leads.
    `.trim();
  }
}

export default new DynamicContentGenerationService();
