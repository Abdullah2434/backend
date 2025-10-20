import UserPostHistory from "../models/UserPostHistory";

export interface VideoData {
  VIDEO_TOPIC: string;
  SCRIPT_HOOK: string;
  SCRIPT_SUMMARY: string;
  AGENT_NAME: string;
  AGENT_CITY: string;
  AGENT_EMAIL?: string;
  AGENT_PHONE?: string;
  AGENT_WEBSITE?: string;
  AGENT_SPECIALTY?: string;
}

export interface PostGenerationResult {
  success: boolean;
  postId?: string;
  platform: string;
  content: {
    caption: string;
    hashtags: string[];
    title?: string;
    description?: string;
  };
  metadata: {
    templateVariant: number;
    topicCategory: string;
    toneUsed: string;
    hookType: string;
    ctaType: string;
    structuralFormat: string;
    openingSentence: string;
    ctaText: string;
  };
  error?: string;
}

export class DynamicPostGenerationService {
  /**
   * Classifies video topic into category for template selection
   */
  static classifyTopic(videoTopic: string): string {
    const topicLower = videoTopic.toLowerCase();

    // Market updates: rates, prices, inventory, trends
    const marketKeywords = [
      "rate",
      "price",
      "inventory",
      "market",
      "housing",
      "mortgage",
      "trend",
      "forecast",
      "drop",
      "rise",
      "increase",
      "decrease",
      "spike",
      "crash",
    ];
    if (marketKeywords.some((keyword) => topicLower.includes(keyword))) {
      return "market_update";
    }

    // Tips/advice: how-to, mistakes, strategies, checklist
    const tipsKeywords = [
      "mistake",
      "tip",
      "how to",
      "strategy",
      "avoid",
      "checklist",
      "guide",
      "step",
      "advice",
      "should",
      "don't",
      "never",
      "always",
      "best",
      "worst",
    ];
    if (tipsKeywords.some((keyword) => topicLower.includes(keyword))) {
      return "tips";
    }

    // Local news: neighborhood, community, local, development
    const localKeywords = [
      "neighborhood",
      "community",
      "local",
      "development",
      "area",
      "district",
      "city",
      "town",
      "region",
      "county",
      "zip",
      "school",
      "schools",
    ];
    if (localKeywords.some((keyword) => topicLower.includes(keyword))) {
      return "local_news";
    }

    // Default to industry analysis
    return "industry_analysis";
  }

  /**
   * Selects template variant based on rotation and topic category
   */
  static selectTemplateVariant(
    postCount: number,
    topicCategory: string,
    recentVariants: number[] = []
  ): number {
    // Base rotation: cycle through 1-5
    let variant = (postCount % 5) + 1;

    // If this variant was used in last 2 posts, shift to next
    if (recentVariants.includes(variant)) {
      variant = (variant % 5) + 1;
    }

    // Weight certain variants for certain topics
    const topicVariantMap: { [key: string]: number[] } = {
      market_update: [1, 3, 4], // Educational, Question-led, List
      tips: [2, 4, 5], // Story, List, Contrarian
      local_news: [2, 4], // Story, List
      industry_analysis: [1, 3, 5], // Educational, Question, Contrarian
    };

    // If variant doesn't fit topic well, pick best alternative
    const preferredVariants = topicVariantMap[topicCategory] || [1, 2, 3, 4, 5];
    if (!preferredVariants.includes(variant)) {
      // Pick random from preferred that wasn't recent
      const availableVariants = preferredVariants.filter(
        (v) => !recentVariants.includes(v)
      );
      variant =
        availableVariants[
          Math.floor(Math.random() * availableVariants.length)
        ] || variant;
    }

    return variant;
  }

  /**
   * Selects tone variation to avoid recent repeats
   */
  static selectTone(platform: string, recentTones: string[] = []): string {
    const tonesByPlatform: { [key: string]: string[] } = {
      youtube: ["educational", "conversational", "analytical", "storytelling"],
      instagram: ["energetic", "casual", "inspirational", "relatable"],
      tiktok: ["ultra_casual", "edgy", "entertaining", "authentic"],
      facebook: ["friendly", "community_focused", "helpful", "conversational"],
      linkedin: ["analytical", "consultative", "conversational", "provocative"],
    };

    const availableTones = tonesByPlatform[platform] || ["conversational"];

    // Filter out recently used tones
    const freshTones = availableTones.filter(
      (tone) => !recentTones.includes(tone)
    );

    // If all tones were recently used, allow reuse but prefer least recent
    const tonesToChooseFrom =
      freshTones.length > 0 ? freshTones : availableTones;

    return tonesToChooseFrom[
      Math.floor(Math.random() * tonesToChooseFrom.length)
    ];
  }

  /**
   * Selects opening hook type, avoiding recent repeats
   */
  static selectHookType(recentHooks: string[] = []): string {
    const hookTypes = [
      "question",
      "bold_statement",
      "story",
      "data",
      "provocative",
    ];

    // Filter out hooks used in last 3 posts
    const availableHooks = hookTypes.filter(
      (hook) => !recentHooks.includes(hook)
    );

    // If all were used recently, allow reuse
    const hooksToChooseFrom =
      availableHooks.length > 0 ? availableHooks : hookTypes;

    return hooksToChooseFrom[
      Math.floor(Math.random() * hooksToChooseFrom.length)
    ];
  }

  /**
   * Selects CTA style, alternating from last post
   */
  static selectCTAType(lastCTA: string | null = null): string {
    const ctaTypes = ["question", "collaborative", "action", "share"];

    // Simple alternation: pick any that's not the last one
    const availableCTAs = ctaTypes.filter((cta) => cta !== lastCTA);

    return availableCTAs[Math.floor(Math.random() * availableCTAs.length)];
  }

  /**
   * Gets user's post history for a specific platform
   */
  static async getPostHistory(
    userId: string,
    platform: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const UserPostHistoryModel = UserPostHistory as any;
      return await UserPostHistoryModel.getPostHistory(userId, platform, limit);
    } catch (error) {
      console.error("Error getting post history:", error);
      return [];
    }
  }

  /**
   * Gets recent template variants used by user on platform
   */
  static async getRecentVariants(
    userId: string,
    platform: string,
    limit: number = 2
  ): Promise<number[]> {
    try {
      const UserPostHistoryModel = UserPostHistory as any;
      const variants = await UserPostHistoryModel.getRecentVariants(
        userId,
        platform,
        limit
      );
      return variants.map((v: any) => v.templateVariant);
    } catch (error) {
      console.error("Error getting recent variants:", error);
      return [];
    }
  }

  /**
   * Gets recent tones used by user on platform
   */
  static async getRecentTones(
    userId: string,
    platform: string,
    limit: number = 2
  ): Promise<string[]> {
    try {
      const UserPostHistoryModel = UserPostHistory as any;
      const tones = await UserPostHistoryModel.getRecentTones(
        userId,
        platform,
        limit
      );
      return tones.map((t: any) => t.toneUsed);
    } catch (error) {
      console.error("Error getting recent tones:", error);
      return [];
    }
  }

  /**
   * Gets recent hook types used by user on platform
   */
  static async getRecentHooks(
    userId: string,
    platform: string,
    limit: number = 3
  ): Promise<string[]> {
    try {
      const UserPostHistoryModel = UserPostHistory as any;
      const hooks = await UserPostHistoryModel.getRecentHooks(
        userId,
        platform,
        limit
      );
      return hooks.map((h: any) => h.hookType);
    } catch (error) {
      console.error("Error getting recent hooks:", error);
      return [];
    }
  }

  /**
   * Gets last CTA type used by user on platform
   */
  static async getLastCTA(
    userId: string,
    platform: string
  ): Promise<string | null> {
    try {
      const UserPostHistoryModel = UserPostHistory as any;
      const lastCTA = await UserPostHistoryModel.getLastCTA(userId, platform);
      return lastCTA ? lastCTA.ctaType : null;
    } catch (error) {
      console.error("Error getting last CTA:", error);
      return null;
    }
  }

  /**
   * Gets recent opening sentences used by user on platform
   */
  static async getRecentOpenings(
    userId: string,
    platform: string,
    limit: number = 3
  ): Promise<string[]> {
    try {
      const UserPostHistoryModel = UserPostHistory as any;
      const openings = await UserPostHistoryModel.getRecentOpenings(
        userId,
        platform,
        limit
      );
      return openings.map((o: any) => o.openingSentence);
    } catch (error) {
      console.error("Error getting recent openings:", error);
      return [];
    }
  }

  /**
   * Gets recent CTA texts used by user on platform
   */
  static async getRecentCTAs(
    userId: string,
    platform: string,
    limit: number = 2
  ): Promise<string[]> {
    try {
      const UserPostHistoryModel = UserPostHistory as any;
      const ctas = await UserPostHistoryModel.getRecentCTAs(
        userId,
        platform,
        limit
      );
      return ctas.map((c: any) => c.ctaText);
    } catch (error) {
      console.error("Error getting recent CTAs:", error);
      return [];
    }
  }

  /**
   * Saves post metadata to history
   */
  static async savePostMetadata(
    userId: string,
    platform: string,
    metadata: {
      videoTopic: string;
      templateVariant: number;
      topicCategory: string;
      toneUsed: string;
      hookType: string;
      ctaType: string;
      structuralFormat: string;
      openingSentence: string;
      ctaText: string;
      fullCaption: string;
    }
  ): Promise<string> {
    try {
      const postId = `${userId}_${platform}_${Date.now()}`;

      const postHistory = new UserPostHistory({
        userId,
        platform,
        postId,
        videoTopic: metadata.videoTopic,
        templateVariant: metadata.templateVariant,
        topicCategory: metadata.topicCategory,
        toneUsed: metadata.toneUsed,
        hookType: metadata.hookType,
        ctaType: metadata.ctaType,
        structuralFormat: metadata.structuralFormat,
        openingSentence: metadata.openingSentence,
        ctaText: metadata.ctaText,
        fullCaption: metadata.fullCaption,
      });

      await postHistory.save();
      return postId;
    } catch (error) {
      console.error("Error saving post metadata:", error);
      throw error;
    }
  }

  /**
   * Extracts first sentence from text
   */
  static extractFirstSentence(text: string): string {
    const match = text.match(/^[^.!?]+[.!?]/);
    return match ? match[0].trim() : text.substring(0, 100);
  }

  /**
   * Extracts CTA from text (last 1-2 sentences)
   */
  static extractCTA(text: string): string {
    const sentences = text.match(/[^.!?]+[.!?]/g) || [];
    return sentences.slice(-2).join(" ").trim();
  }

  /**
   * Extracts hashtags from text
   */
  static extractHashtags(text: string): string[] {
    const hashtagRegex = /#\w+/g;
    return text.match(hashtagRegex) || [];
  }
}

export default DynamicPostGenerationService;
