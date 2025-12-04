/**
 * Types for SocialBu controllers
 */

export interface Captions {
  caption?: string;
  instagram_caption?: string;
  facebook_caption?: string;
  linkedin_caption?: string;
  twitter_caption?: string;
  tiktok_caption?: string;
  youtube_caption?: string;
}

export interface MediaResponse {
  id?: string;
  userId?: string;
  name?: string;
  mime_type?: string;
  socialbuResponse?: any;
  uploadScript?: string;
  status?: string;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Account {
  id: number;
  name: string;
  type: string;
}

