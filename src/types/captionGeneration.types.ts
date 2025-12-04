/**
 * Types for caption generation service
 */

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface SocialMediaCaptions {
  instagram_caption: string;
  facebook_caption: string;
  linkedin_caption: string;
  twitter_caption: string;
  tiktok_caption: string;
  youtube_caption: string;
}

export interface UserContext {
  name?: string;
  position?: string;
  companyName?: string;
  city?: string;
  socialHandles?: string;
}

