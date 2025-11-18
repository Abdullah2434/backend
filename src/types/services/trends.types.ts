/**
 * Types for trends service
 */

export interface TrendData {
  description: string;
  keypoints: string;
  instagram_caption?: string;
  facebook_caption?: string;
  linkedin_caption?: string;
  twitter_caption?: string;
  tiktok_caption?: string;
  youtube_caption?: string;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface CityData {
  neighborhoods: string[];
  priceRange: string;
  marketTrend: string;
  keyFeatures: string[];
  popularAreas: string[];
}

export interface ContentSafetyResult {
  isSafe: boolean;
  reason?: string;
  category?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

