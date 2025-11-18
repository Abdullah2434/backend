/**
 * Helper functions for dynamic post generation service
 */

import {
  TopicAnalysis,
  PostPatterns,
  ContentStructure,
} from "../types/services/dynamicPostGeneration.types";
import {
  MARKET_KEYWORDS,
  TIPS_KEYWORDS,
  LOCAL_KEYWORDS,
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
  POST_HISTORY_LIMIT,
  PATTERN_ANALYSIS_LIMIT,
  RECENT_POSTS_FOR_ANALYSIS,
  RECENT_VARIANTS_TO_AVOID,
  RECENT_CTAS_TO_AVOID,
  HIGH_SIMILARITY_THRESHOLD,
} from "../constants/dynamicPostGeneration.constants";

// ==================== TOPIC ANALYSIS ====================
/**
 * Analyze topic and classify it
 */
export function analyzeTopic(
  topic: string,
  keyPoints: string
): TopicAnalysis {
  const topicLower = topic.toLowerCase();
  const keyPointsLower = keyPoints.toLowerCase();

  // Market updates: rates, prices, inventory, trends
  if (
    MARKET_KEYWORDS.some(
      (keyword) =>
        topicLower.includes(keyword) || keyPointsLower.includes(keyword)
    )
  ) {
    return {
      topic,
      topicType: "market_update",
      sentiment: determineSentiment(topicLower, keyPointsLower),
      keyPoints: keyPoints.split(",").map((kp) => kp.trim()),
    };
  }

  // Tips/advice: how-to, mistakes, strategies, checklist
  if (
    TIPS_KEYWORDS.some(
      (keyword) =>
        topicLower.includes(keyword) || keyPointsLower.includes(keyword)
    )
  ) {
    return {
      topic,
      topicType: "tips",
      sentiment: determineSentiment(topicLower, keyPointsLower),
      keyPoints: keyPoints.split(",").map((kp) => kp.trim()),
    };
  }

  // Local news: neighborhood, community, local, development
  if (
    LOCAL_KEYWORDS.some(
      (keyword) =>
        topicLower.includes(keyword) || keyPointsLower.includes(keyword)
    )
  ) {
    return {
      topic,
      topicType: "local_news",
      sentiment: determineSentiment(topicLower, keyPointsLower),
      keyPoints: keyPoints.split(",").map((kp) => kp.trim()),
    };
  }

  // Default to industry analysis
  return {
    topic,
    topicType: "industry_analysis",
    sentiment: determineSentiment(topicLower, keyPointsLower),
    keyPoints: keyPoints.split(",").map((kp) => kp.trim()),
  };
}

/**
 * Determine sentiment from topic and key points
 */
export function determineSentiment(
  topicLower: string,
  keyPointsLower: string
): "positive" | "negative" | "neutral" {
  const combinedText = `${topicLower} ${keyPointsLower}`;

  if (POSITIVE_WORDS.some((word) => combinedText.includes(word))) {
    return "positive";
  }
  if (NEGATIVE_WORDS.some((word) => combinedText.includes(word))) {
    return "negative";
  }
  return "neutral";
}

// ==================== POST PATTERN ANALYSIS ====================
/**
 * Analyze post patterns for Smart Memory System
 */
export function analyzePostPatterns(userHistory: any[]): PostPatterns {
  const recentPosts = userHistory.slice(0, PATTERN_ANALYSIS_LIMIT);

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
    contentSimilarity: calculateContentSimilarity(recentPosts),
  };
}

/**
 * Calculate content similarity between recent posts
 */
export function calculateContentSimilarity(posts: any[]): number {
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

// ==================== TEMPLATE SELECTION ====================
/**
 * Select template variant with Smart Memory System
 */
export function selectTemplateVariant(
  availableVariants: number[],
  userHistory: any[]
): number {
  if (availableVariants.length === 0) {
    return 0; // This will trigger fallback
  }

  // Anti-Repetition: Avoid templates used in last 2 posts
  const recentVariants = userHistory
    .slice(0, RECENT_VARIANTS_TO_AVOID)
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

    return oldestVariant;
  }

  // Randomly select from unused variants
  const selectedVariant =
    unusedVariants[Math.floor(Math.random() * unusedVariants.length)];

  return selectedVariant;
}

/**
 * Select hook type with Smart Memory System
 */
export function selectHookType(
  templateHookType: string,
  userHistory: any[]
): string {
  const recentHookTypes = userHistory
    .slice(0, RECENT_POSTS_FOR_ANALYSIS)
    .map((post) => post.hookType);

  const availableHooks = [
    "question",
    "bold_statement",
    "story",
    "data",
    "provocative",
  ];

  // If template's hook type wasn't used recently, use it
  if (!recentHookTypes.includes(templateHookType)) {
    return templateHookType;
  }

  // Otherwise, select from available hooks that weren't used recently
  const available = availableHooks.filter(
    (hook) => !recentHookTypes.includes(hook)
  );

  return available.length > 0 ? available[0] : availableHooks[0];
}

/**
 * Select tone with Smart Memory System
 */
export function selectTone(
  templateTone: string,
  topicAnalysis: TopicAnalysis,
  userHistory: any[]
): string {
  // Anti-Repetition: Avoid tones used in last 3 posts
  const recentTones = userHistory
    .slice(0, RECENT_POSTS_FOR_ANALYSIS)
    .map((post) => post.tone);

  // Use template's default tone, but adjust based on topic and history
  let selectedTone = templateTone;

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
    }
  }

  return selectedTone;
}

/**
 * Select CTA type with Smart Memory System
 */
export function selectCtaType(
  templateCtaType: string,
  userHistory: any[]
): string {
  const recentCtaTypes = userHistory
    .slice(0, RECENT_CTAS_TO_AVOID)
    .map((post) => post.ctaType);

  // If template's CTA type wasn't used recently, use it
  if (!recentCtaTypes.includes(templateCtaType)) {
    return templateCtaType;
  }

  // Otherwise, select from available CTA types
  const availableCtaTypes = ["question", "collaborative", "action", "share"];
  const available = availableCtaTypes.filter(
    (cta) => !recentCtaTypes.includes(cta)
  );

  return available.length > 0 ? available[0] : templateCtaType;
}

// ==================== CONTENT EXTRACTION ====================
/**
 * Extract metadata from generated content
 */
export function extractMetadata(content: string): {
  characterCount: number;
  hashtagCount: number;
  emojiCount: number;
  timestamp: string;
} {
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
export function extractHashtags(content: string): string[] {
  return (content.match(/#\w+/g) || []).map((tag) => tag.substring(1));
}

/**
 * Extract CTA from content
 */
export function extractCTA(content: string): string {
  const sentences = content.match(/[^.!?]+[.!?]/g) || [];
  return sentences.slice(-2).join(" ").trim();
}

/**
 * Parse content structure for storage
 */
export function parseContentStructure(content: string): ContentStructure {
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

// ==================== CONTENT CLEANUP ====================
/**
 * Clean quotation marks from AI response
 */
export function cleanQuotationMarks(content: string): string {
  return content.replace(/"/g, "");
}

// ==================== VALIDATION ====================
/**
 * Check if content similarity is high
 */
export function isHighSimilarity(similarity: number): boolean {
  return similarity > HIGH_SIMILARITY_THRESHOLD;
}

/**
 * Get opening sentence from content
 */
export function getOpeningSentence(content: string): string {
  return content.split("\n")[0] || content.substring(0, 100);
}

