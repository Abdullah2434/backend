/**
 * Types for fetchDefaultAvatars cron job
 */

export interface HeyGenVideoAvatar {
  avatar_id: string;
  avatar_name?: string;
  gender?: string;
  preview_image_url?: string;
  preview_video_url?: string;
}

export interface HeyGenPhotoAvatar {
  talking_photo_id: string;
  talking_photo_name?: string;
  preview_image_url?: string;
}

export interface HeyGenVoice {
  voice_id: string;
  language: string;
  gender: string;
  name?: string;
  preview_audio?: string;
}

export interface HeyGenAvatarsAPIResponse {
  data?: {
    avatars?: HeyGenVideoAvatar[];
    talking_photos?: HeyGenPhotoAvatar[];
  };
}

export interface HeyGenVoicesAPIResponse {
  data?: {
    voices?: HeyGenVoice[];
  };
}

export interface ProcessedAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url?: string;
  preview_video_url?: string | null;
  avatarType: "video_avatar" | "photo_avatar";
}

export interface ProcessAvatarResult {
  success: boolean;
  avatarId?: string;
  error?: string;
}

export interface ProcessVoiceResult {
  success: boolean;
  voiceId?: string;
  error?: string;
}

export interface FetchAvatarsSummary {
  total: number;
  created: number;
  updated: number;
  errors: number;
}

export interface FetchVoicesSummary {
  total: number;
  created: number;
  errors: number;
}

export interface ProcessAvatarConfig {
  apiTimeoutMs: number;
  databaseTimeoutMs: number;
}

