/**
 * Types for dynamic post generation service
 */

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

export interface PostPatterns {
  recentOpeningSentences: string[];
  recentHookTypes: string[];
  recentTones: string[];
  recentCtaTypes: string[];
  recentTemplates: number[];
  contentSimilarity: number;
}

export interface ContentStructure {
  hook: string;
  description: string;
  keyPoints: string[];
  conclusion: string;
}

