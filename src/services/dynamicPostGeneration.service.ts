import OpenAI from "openai";
import ContentTemplate from "../models/ContentTemplate";
import UserPostHistory from "../models/UserPostHistory";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface UserContext {
  name: string;
  position: string;
  companyName: string;
  city: string;
  socialHandles: string;
}

export interface TopicAnalysis {
  topic: string;
  topicType:
    | "market_update"
    | "tips"
    | "local_news"
    | "industry_analysis"
    | "general";
  sentiment: "positive" | "negative" | "neutral";
  keyPoints: string[];
}

export interface GeneratedPost {
  platform: string;
  content: string;
  templateVariant: number;
  hookType: string;
  tone: string;
  ctaType: string;
  hashtags: string[];
  metadata: {
    characterCount: number;
    hashtagCount: number;
    emojiCount: number;
    isFallback?: boolean;
    reason?: string;
    timestamp?: string;
  };
}

export class DynamicPostGenerationService {
  /**
   * Generate dynamic multi-platform posts with Smart Memory System
   */
  static async generateDynamicPosts(
    topic: string,
    keyPoints: string,
    userContext: UserContext,
    userId: string,
    platforms: string[] = [
      "instagram",
      "facebook",
      "linkedin",
      "twitter",
      "tiktok",
      "youtube",
    ]
  ): Promise<GeneratedPost[]> {
    console.log(
      `🎯 Generating dynamic posts for user ${userId} on topic: ${topic}`
    );

    // Step 1: Analyze topic and classify
    const topicAnalysis = await this.analyzeTopic(topic, keyPoints);
    console.log(
      `📊 Topic analysis: ${topicAnalysis.topicType} - ${topicAnalysis.sentiment}`
    );

    // Step 2: Get user's post history for each platform
    const userHistory = await this.getUserPostHistory(userId, platforms);
    console.log(
      `📚 Retrieved history for ${Object.keys(userHistory).length} platforms`
    );

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
        console.log(
          `✅ Generated ${platform} post (variant ${post.templateVariant})`
        );
      } catch (error) {
        console.error(`❌ Failed to generate ${platform} post:`, error);
        // Continue with other platforms
      }
    }

    return generatedPosts;
  }

  /**
   * Analyze topic and classify it according to the documentation
   */
  private static async analyzeTopic(
    topic: string,
    keyPoints: string
  ): Promise<TopicAnalysis> {
    const topicLower = topic.toLowerCase();
    const keyPointsLower = keyPoints.toLowerCase();

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
    ];
    if (
      marketKeywords.some(
        (keyword) =>
          topicLower.includes(keyword) || keyPointsLower.includes(keyword)
      )
    ) {
      return {
        topic,
        topicType: "market_update",
        sentiment: this.determineSentiment(topicLower, keyPointsLower),
        keyPoints: keyPoints.split(",").map((kp) => kp.trim()),
      };
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
    ];
    if (
      tipsKeywords.some(
        (keyword) =>
          topicLower.includes(keyword) || keyPointsLower.includes(keyword)
      )
    ) {
      return {
        topic,
        topicType: "tips",
        sentiment: this.determineSentiment(topicLower, keyPointsLower),
        keyPoints: keyPoints.split(",").map((kp) => kp.trim()),
      };
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
      "downtown",
      "suburb",
    ];
    if (
      localKeywords.some(
        (keyword) =>
          topicLower.includes(keyword) || keyPointsLower.includes(keyword)
      )
    ) {
      return {
        topic,
        topicType: "local_news",
        sentiment: this.determineSentiment(topicLower, keyPointsLower),
        keyPoints: keyPoints.split(",").map((kp) => kp.trim()),
      };
    }

    // Default to industry analysis
    return {
      topic,
      topicType: "industry_analysis",
      sentiment: this.determineSentiment(topicLower, keyPointsLower),
      keyPoints: keyPoints.split(",").map((kp) => kp.trim()),
    };
  }

  /**
   * Determine sentiment from topic and key points
   */
  private static determineSentiment(
    topicLower: string,
    keyPointsLower: string
  ): "positive" | "negative" | "neutral" {
    const positiveWords = [
      "increase",
      "rise",
      "growth",
      "opportunity",
      "benefit",
      "advantage",
      "success",
      "boom",
      "hot",
      "strong",
    ];
    const negativeWords = [
      "decrease",
      "drop",
      "fall",
      "decline",
      "crash",
      "crisis",
      "problem",
      "issue",
      "concern",
      "weak",
    ];

    const combinedText = `${topicLower} ${keyPointsLower}`;

    if (positiveWords.some((word) => combinedText.includes(word))) {
      return "positive";
    }
    if (negativeWords.some((word) => combinedText.includes(word))) {
      return "negative";
    }
    return "neutral";
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
          .limit(10)
          .lean();

        history[platform] = posts;
      } catch (error) {
        console.warn(`Failed to get history for ${platform}:`, error);
        history[platform] = [];
      }
    }

    return history;
  }

  /**
   * Analyze post patterns for Smart Memory System
   */
  private static analyzePostPatterns(userHistory: any[]): {
    recentOpeningSentences: string[];
    recentHookTypes: string[];
    recentTones: string[];
    recentCtaTypes: string[];
    recentTemplates: number[];
    contentSimilarity: number;
  } {
    const recentPosts = userHistory.slice(0, 5); // Last 5 posts for pattern analysis

    return {
      recentOpeningSentences: recentPosts
        .map((p) => p.openingSentence || "")
        .filter((s) => s.length > 0),
      recentHookTypes: recentPosts.map((p) => p.hookType).filter(Boolean),
      recentTones: recentPosts.map((p) => p.tone).filter(Boolean),
      recentCtaTypes: recentPosts.map((p) => p.ctaType).filter(Boolean),
      recentTemplates: recentPosts
        .map((p) => p.templateVariant)
        .filter(Boolean),
      contentSimilarity: this.calculateContentSimilarity(recentPosts),
    };
  }

  /**
   * Calculate content similarity between recent posts
   */
  private static calculateContentSimilarity(posts: any[]): number {
    if (posts.length < 2) return 0;

    const recentContent = posts
      .slice(0, 2)
      .map((p) => p.contentStructure?.description || "");
    if (recentContent.length < 2) return 0;

    // Simple similarity check based on common words
    const words1 = recentContent[0].toLowerCase().split(/\s+/);
    const words2 = recentContent[1].toLowerCase().split(/\s+/);
    const commonWords = words1.filter((word: string) => words2.includes(word));

    return commonWords.length / Math.max(words1.length, words2.length);
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
    // Step 1: Select template variant (avoid recent ones)
    const templateVariant = await this.selectTemplateVariant(
      platform,
      userHistory
    );

    // Step 2: Get template
    const template = await ContentTemplate.findOne({
      platform: platform as any,
      variant: templateVariant,
      isActive: true,
    });

    if (!template) {
      console.warn(
        `⚠️ No template found for ${platform} variant ${templateVariant}, using fallback`
      );

      // Return a fallback post with basic content
      const fallbackContent = `${topicAnalysis.topic} - ${topicAnalysis.keyPoints}`;
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

    // Step 3: Select content variations
    const hookType = this.selectHookType(template, userHistory);
    const tone = this.selectTone(template, topicAnalysis, userHistory);
    const ctaType = this.selectCtaType(template, userHistory);

    // Step 4: Generate content using AI
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

    // Step 5: Extract metadata
    const metadata = this.extractMetadata(content);

    // Step 6: Save to history
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
      hashtags: this.extractHashtags(content),
      metadata,
    };
  }

  /**
   * Select template variant with Smart Memory System
   */
  private static async selectTemplateVariant(
    platform: string,
    userHistory: any[]
  ): Promise<number> {
    // Get available variants from database
    const availableTemplates = await ContentTemplate.find({
      platform: platform as any,
      isActive: true,
    }).select("variant");

    const availableVariants = availableTemplates.map((t: any) => t.variant);

    if (availableVariants.length === 0) {
      console.warn(`⚠️ No templates found for ${platform}, using fallback`);
      return 0; // This will trigger fallback
    }

    // Smart Memory System: Analyze recent usage patterns
    const patterns = this.analyzePostPatterns(userHistory);

    // Anti-Repetition: Avoid templates used in last 2 posts
    const recentVariants = userHistory
      .slice(0, 2)
      .map((post) => post.templateVariant);

    // Filter out recently used variants
    const unusedVariants = availableVariants.filter(
      (v: any) => !recentVariants.includes(v)
    );

    if (unusedVariants.length === 0) {
      // If all variants were used recently, pick the least recent (oldest)
      const oldestVariant =
        userHistory.length > 0
          ? userHistory[userHistory.length - 1].templateVariant
          : availableVariants[0];

      console.log(
        `🔄 All variants used recently for ${platform}, using oldest: ${oldestVariant}`
      );
      return oldestVariant;
    }

    // Smart Selection: Prefer variants that haven't been used recently
    const smartVariants = unusedVariants.filter((variant: any) => {
      // Additional logic can be added here to avoid similar content patterns
      return true; // For now, use all unused variants
    });

    // Randomly select from smart variants
    const selectedVariant =
      smartVariants[Math.floor(Math.random() * smartVariants.length)];

    console.log(
      `🎯 Selected template variant ${selectedVariant} for ${platform} (avoiding recent: ${recentVariants.join(
        ", "
      )})`
    );
    return selectedVariant;
  }

  /**
   * Select hook type with Smart Memory System
   */
  private static selectHookType(template: any, userHistory: any[]): string {
    // Smart Memory System: Analyze recent hook patterns
    const patterns = this.analyzePostPatterns(userHistory);

    const recentHookTypes = userHistory
      .slice(0, 3)
      .map((post) => post.hookType);

    const templateHookType = template.structure.hook.type;
    const availableHooks = [
      "question",
      "bold_statement",
      "story",
      "data",
      "provocative",
    ];

    // If template's hook type wasn't used recently, use it
    if (!recentHookTypes.includes(templateHookType)) {
      console.log(
        `🎯 Using template hook type: ${templateHookType} (not used recently)`
      );
      return templateHookType;
    }

    // Otherwise, select from available hooks that weren't used recently
    const available = availableHooks.filter(
      (hook) => !recentHookTypes.includes(hook)
    );

    const selectedHook =
      available.length > 0 ? available[0] : availableHooks[0];
    console.log(
      `🔄 Template hook used recently, selected: ${selectedHook} (avoiding: ${recentHookTypes.join(
        ", "
      )})`
    );
    return selectedHook;
  }

  /**
   * Select tone with Smart Memory System
   */
  private static selectTone(
    template: any,
    topicAnalysis: TopicAnalysis,
    userHistory: any[]
  ): string {
    // Smart Memory System: Analyze recent tone patterns
    const patterns = this.analyzePostPatterns(userHistory);

    // Anti-Repetition: Avoid tones used in last 3 posts
    const recentTones = userHistory.slice(0, 3).map((post) => post.tone);

    // Use template's default tone, but adjust based on topic and history
    let selectedTone = template.tone;

    // Topic-based tone adjustment
    if (
      topicAnalysis.topicType === "market_update" &&
      topicAnalysis.sentiment === "positive"
    ) {
      selectedTone = "energetic";
    } else if (topicAnalysis.topicType === "tips") {
      selectedTone = "educational";
    } else if (topicAnalysis.topicType === "local_news") {
      selectedTone = "casual";
    }

    // Anti-Repetition: If selected tone was used recently, try alternatives
    if (recentTones.includes(selectedTone)) {
      const availableTones = [
        "casual",
        "professional",
        "educational",
        "energetic",
      ];
      const unusedTones = availableTones.filter(
        (tone) => !recentTones.includes(tone)
      );

      if (unusedTones.length > 0) {
        selectedTone = unusedTones[0];
        console.log(
          `🔄 Tone '${template.tone}' used recently, selected: ${selectedTone}`
        );
      } else {
        console.log(`🔄 All tones used recently, keeping: ${selectedTone}`);
      }
    }

    return selectedTone;
  }

  /**
   * Select CTA type with Smart Memory System
   */
  private static selectCtaType(template: any, userHistory: any[]): string {
    // Smart Memory System: Analyze recent CTA patterns
    const patterns = this.analyzePostPatterns(userHistory);

    const recentCtaTypes = userHistory.slice(0, 2).map((post) => post.ctaType);
    const templateCtaType = template.structure.conclusion.ctaType;

    // If template's CTA type wasn't used recently, use it
    if (!recentCtaTypes.includes(templateCtaType)) {
      console.log(
        `🎯 Using template CTA type: ${templateCtaType} (not used recently)`
      );
      return templateCtaType;
    }

    // Otherwise, select from available CTA types
    const availableCtaTypes = ["question", "collaborative", "action", "share"];
    const available = availableCtaTypes.filter(
      (cta) => !recentCtaTypes.includes(cta)
    );

    const selectedCta = available.length > 0 ? available[0] : templateCtaType;

    console.log(
      `🔄 Template CTA '${templateCtaType}' used recently, selected: ${selectedCta} (avoiding: ${recentCtaTypes.join(
        ", "
      )})`
    );
    return selectedCta;
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
    // Enhanced prompt with sophisticated engineering from specification
    const memoryContext = this.buildEnhancedMemoryContext(
      topicAnalysis,
      userContext,
      userHistory
    );

    // Platform-Specific Guidelines from specification
    const platformGuidelines = this.getPlatformGuidelines(platform);

    // Template Structure from specification
    const templateStructure = this.getTemplateStructure(template, platform);

    const prompt = `You are an expert social media copywriter specializing in real estate content for ${platform}.

VIDEO CONTEXT:
- Topic: ${topicAnalysis.topic}
- Script Hook: ${topicAnalysis.keyPoints[0] || topicAnalysis.topic}
- Script Summary: ${topicAnalysis.keyPoints.join(", ")}
- Agent: ${userContext.name} serving ${userContext.city}
- Specialty: ${userContext.position}

TEMPLATE TO USE:
${templateStructure}

VARIATION REQUIREMENTS (CRITICAL - MUST FOLLOW):
- Template Variant: #${template.variant} of 5
- Topic Category: ${topicAnalysis.topicType}
- Tone: ${tone}
- Opening Hook Type: ${hookType}
- CTA Type: ${ctaType}

${memoryContext}

CRITICAL INSTRUCTIONS:
1. Write in ${tone} tone appropriate for ${platform}
2. Use ${hookType} style for opening (question, bold statement, story, data, or provocative)
3. Vary sentence structure and rhythm from recent posts
4. CTA must be ${ctaType}-style and feel fresh
5. Make it authentic to ${platform} culture, not templated or robotic
6. Reference ${topicAnalysis.topic} naturally throughout
7. Keep it natural and conversational - this should sound human

Platform-Specific Guidelines:
${platformGuidelines}

Generate the post now, following the template structure and variation requirements.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert social media copywriter specializing in real estate content for ${platform}. You write authentic, engaging posts that follow platform best practices and avoid repetitive patterns.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.75,
        max_tokens: 1500,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Error generating AI content:", error);
      throw new Error("Failed to generate content with AI");
    }
  }

  /**
   * Get platform-specific optimizations for content generation
   */
  private static getPlatformOptimizations(platform: string): string {
    const optimizations = {
      instagram: `
INSTAGRAM OPTIMIZATION:
- Visual-first content with strong visual appeal
- Use relevant hashtags (5-8 hashtags)
- Include emojis for engagement
- Keep descriptions concise but engaging
- Focus on lifestyle and aspirational content
- Use line breaks for readability
- Include location tags when relevant
- Encourage user-generated content`,

      facebook: `
FACEBOOK OPTIMIZATION:
- Community-focused, conversational tone
- Encourage discussion and comments
- Use 3-5 relevant hashtags
- Include local community references
- Ask questions to drive engagement
- Share personal insights and experiences
- Use longer-form content (up to 400 characters)
- Focus on local market insights`,

      linkedin: `
LINKEDIN OPTIMIZATION:
- Professional, thought-leadership tone
- Industry insights and expertise
- Use 2-3 professional hashtags
- Focus on business and career development
- Include data and statistics
- Share professional experiences
- Encourage professional networking
- Avoid excessive emojis`,

      tiktok: `
TIKTOK OPTIMIZATION:
- Ultra-short, scroll-stopping content
- Use trending hashtags (5-7 hashtags)
- Heavy emoji usage for engagement
- Quick, actionable tips
- Behind-the-scenes content
- Use trending audio concepts
- Focus on quick wins and tips
- Encourage shares and saves`,

      youtube: `
YOUTUBE OPTIMIZATION:
- Educational, comprehensive content
- Detailed explanations and insights
- Use 8-12 relevant hashtags
- Include timestamps for longer content
- Focus on tutorials and guides
- Encourage subscriptions
- Include call-to-action for engagement
- Professional but accessible tone`,
    };

    return optimizations[platform as keyof typeof optimizations] || "";
  }

  /**
   * Build memory context for AI generation with Smart Memory System
   */
  private static buildMemoryContext(
    topicAnalysis: TopicAnalysis,
    userContext: UserContext,
    userHistory: any[] = []
  ): string {
    // Smart Memory System: Analyze recent patterns
    const patterns = this.analyzePostPatterns(userHistory);

    let memoryContext = `SMART MEMORY SYSTEM - AVOID THESE RECENT PATTERNS:
- Recent opening sentences: ${
      patterns.recentOpeningSentences.slice(0, 3).join(", ") || "None"
    }
- Recent hook types: ${
      patterns.recentHookTypes.slice(0, 3).join(", ") || "None"
    }
- Recent tones: ${patterns.recentTones.slice(0, 3).join(", ") || "None"}
- Recent CTA types: ${patterns.recentCtaTypes.slice(0, 3).join(", ") || "None"}
- Content similarity score: ${patterns.contentSimilarity.toFixed(
      2
    )} (lower is better)

ANTI-REPETITION RULES:
- Don't repeat opening sentences from recent posts
- Vary your hook types and CTA approaches
- Mix up your tone and structure
- Ensure each post feels unique and authentic
- Avoid similar content patterns`;

    if (patterns.contentSimilarity > 0.3) {
      memoryContext += `\n\n⚠️ HIGH SIMILARITY DETECTED: Recent posts are too similar. Create something completely different!`;
    }

    memoryContext += `\n\nUSER PROFILE:
- Specializes in: ${userContext.position}
- Based in: ${userContext.city}
- Company: ${userContext.companyName}
- Social: ${userContext.socialHandles}

TOPIC CONTEXT:
- This is a ${topicAnalysis.topicType} post
- Sentiment: ${topicAnalysis.sentiment}
- Key focus areas: ${topicAnalysis.keyPoints.join(", ")}`;

    return memoryContext;
  }

  /**
   * Extract metadata from generated content
   */
  private static extractMetadata(content: string): any {
    return {
      characterCount: content.length,
      hashtagCount: (content.match(/#\w+/g) || []).length,
      emojiCount: (
        content.match(
          /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
        ) || []
      ).length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract hashtags from content
   */
  private static extractHashtags(content: string): string[] {
    return (content.match(/#\w+/g) || []).map((tag) => tag.substring(1));
  }

  /**
   * Extract CTA from content
   */
  private static extractCTA(content: string): string {
    const sentences = content.match(/[^.!?]+[.!?]/g) || [];
    return sentences.slice(-2).join(" ").trim();
  }

  /**
   * Parse content structure for storage
   */
  private static parseContentStructure(content: string): any {
    const lines = content.split("\n").filter((line) => line.trim());

    return {
      hook: lines[0] || content.substring(0, 100),
      description: lines.slice(1, -1).join(" ") || content.substring(100, 200),
      keyPoints: lines.filter(
        (line) => line.includes("•") || line.includes("-")
      ),
      conclusion: lines[lines.length - 1] || content.substring(-100),
    };
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
      openingSentence: content.split("\n")[0] || content.substring(0, 100),
      cta: this.extractCTA(content),
      hashtags: this.extractHashtags(content),
      contentStructure: this.parseContentStructure(content),
      metadata,
    });

    await postHistory.save();
  }

  /**
   * Enhanced Memory Context Builder from specification
   */
  private static buildEnhancedMemoryContext(
    topicAnalysis: TopicAnalysis,
    userContext: UserContext,
    userHistory: any[] = []
  ): string {
    // Smart Memory System: Analyze recent patterns
    const patterns = this.analyzePostPatterns(userHistory);

    // Extract recent post metadata for avoidance
    const recentOpenings = userHistory
      .slice(0, 3)
      .map((p) => p.openingSentence);
    const recentCTAs = userHistory.slice(0, 2).map((p) => p.cta);

    let memoryContext = `SMART MEMORY SYSTEM - AVOID THESE RECENT PATTERNS:
- Recent opening sentences: ${
      patterns.recentOpeningSentences.slice(0, 3).join(", ") || "None"
    }
- Recent hook types: ${
      patterns.recentHookTypes.slice(0, 3).join(", ") || "None"
    }
- Recent tones: ${patterns.recentTones.slice(0, 3).join(", ") || "None"}
- Recent CTA types: ${patterns.recentCtaTypes.slice(0, 3).join(", ") || "None"}
- Content similarity score: ${patterns.contentSimilarity.toFixed(
      2
    )} (lower is better)

ANTI-REPETITION RULES:
- Don't repeat opening sentences from recent posts
- Vary your hook types and CTA approaches
- Mix up your tone and structure
- Ensure each post feels unique and authentic
- Avoid similar content patterns`;

    if (patterns.contentSimilarity > 0.3) {
      memoryContext += `\n\n⚠️ HIGH SIMILARITY DETECTED: Recent posts are too similar. Create something completely different!`;
    }

    memoryContext += `\n\nUSER PROFILE:
- Specializes in: ${userContext.position}
- Based in: ${userContext.city}
- Company: ${userContext.companyName}
- Social: ${userContext.socialHandles}

TOPIC CONTEXT:
- This is a ${topicAnalysis.topicType} post
- Sentiment: ${topicAnalysis.sentiment}
- Key focus areas: ${topicAnalysis.keyPoints.join(", ")}`;

    return memoryContext;
  }

  /**
   * Get Platform-Specific Guidelines from specification
   */
  private static getPlatformGuidelines(platform: string): string {
    const guidelines = {
      youtube: `
- Description should be 300-500 words, comprehensive
- Include timestamps if video has clear sections
- Always include contact info and about section
- Use 3-5 hashtags max
- SEO-optimize title (60-70 chars)
- Include clear CTA for likes, comments, subscribes`,

      instagram: `
- Caption should be 150-300 words
- Lead with strong hook in first 1-2 lines
- Use line breaks for readability (blank lines between sections)
- Use emojis strategically (2-3 per section, not excessive)
- 5-8 hashtags in caption, 20-25 in first comment
- CTA should encourage saves, tags, or DMs
- Conversational "you" language`,

      tiktok: `
- Caption MUST be 100-150 characters max (TikTok users don't read long)
- Ultra-punchy, scroll-stopping hook
- 3-5 hashtags only
- 1-2 emojis max
- No long paragraphs - keep it snappy
- Always include #fyp`,

      facebook: `
- Keep it short: 50-100 words
- Friendly, community-focused tone
- 2-3 emojis total (moderate use)
- Ask questions to drive comments
- 1-3 hashtags max (optional)
- Focus on local community connection`,

      linkedin: `
- Professional length: 150-250 words
- Use paragraphs with line breaks (not walls of text)
- NO EMOJIS (maintain professional credibility)
- First-person or analytical perspective
- Industry insights and thought leadership
- 3-5 professional hashtags
- CTA should be consultative or discussion-focused`,
    };

    return guidelines[platform as keyof typeof guidelines] || "";
  }

  /**
   * Get Template Structure from specification
   */
  private static getTemplateStructure(template: any, platform: string): string {
    // Return the detailed template structure from the database
    return `SYSTEM CONTEXT: ${template.description}

STRUCTURE:
${template.structure.description.template}

HOOK TYPE: ${template.structure.hook.type}
HOOK TEMPLATE: ${template.structure.hook.template}
HOOK EXAMPLES: ${template.structure.hook.examples.join(", ")}

KEY POINTS TEMPLATE: ${template.structure.keyPoints.template}
MAX POINTS: ${template.structure.keyPoints.maxPoints}

CONCLUSION CTA TYPE: ${template.structure.conclusion.ctaType}
CONCLUSION TEMPLATE: ${template.structure.conclusion.template}
CONCLUSION EXAMPLES: ${template.structure.conclusion.examples.join(", ")}

TONE: ${template.tone}
PLATFORM OPTIMIZATIONS:
- Max Length: ${template.platformOptimizations.maxLength} characters
- Hashtag Count: ${template.platformOptimizations.hashtagCount}
- Emoji Usage: ${template.platformOptimizations.emojiUsage}
- Line Breaks: ${template.platformOptimizations.lineBreaks ? "Yes" : "No"}
- Call to Action: ${template.platformOptimizations.callToAction}`;
  }
}
