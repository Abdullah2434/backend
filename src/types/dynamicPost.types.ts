// ==================== DYNAMIC POST TYPES ====================

/**
 * User context information for dynamic post generation
 */
export interface UserContext {
  name: string;
  position: string;
  companyName: string;
  city: string;
  socialHandles: string;
  language?: string;
}

/**
 * Post analytics data structure
 */
export interface PostAnalytics {
  totalPosts: number;
  platforms: Record<string, number>;
  templateVariants: Record<string, number>;
  hookTypes: Record<string, number>;
  tones: Record<string, number>;
  ctaTypes: Record<string, number>;
  topicTypes: Record<string, number>;
  averageCharacterCount: number;
  averageHashtagCount: number;
  averageEmojiCount: number;
}

// ValidationError is already defined in src/types/index.ts

/**
 * Post history query parameters
 */
export interface PostHistoryQuery {
  platform?: string;
  limit: number;
}

/**
 * Post analytics query parameters
 */
export interface PostAnalyticsQuery {
  platform?: string;
  days: number;
}

/**
 * Templates query parameters
 */
export interface TemplatesQuery {
  platform?: string;
  variant?: number;
}

/**
 * Default user context values
 */
export interface DefaultUserContext {
  name: string;
  position: string;
  companyName: string;
  city: string;
  socialHandles: string;
}

