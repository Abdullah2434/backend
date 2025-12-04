/**
 * Types for VideoSchedule services
 */

export interface ScheduleEmailData {
  userEmail: string;
  userName?: string;
  scheduleId: string;
  frequency: string;
  startDate: Date;
  endDate: Date;
  totalVideos: number;
  timezone: string;
  schedule: {
    days: string[];
    times: string[];
  };
  videos: Array<{
    description: string;
    keypoints: string;
    scheduledFor: Date;
    status: string;
  }>;
}

export interface VideoGeneratedEmailData {
  userEmail: string;
  userName?: string;
  videoTitle: string;
  videoDescription: string;
  videoKeypoints: string;
  generatedAt: Date;
  videoId?: string;
  isLastVideo: boolean;
  scheduleId: string;
  timezone: string;
}

export interface VideoProcessingEmailData {
  userEmail: string;
  userName?: string;
  videoTitle: string;
  videoDescription: string;
  videoKeypoints: string;
  startedAt: Date;
  scheduleId: string;
  timezone: string;
}

export interface VideoLimitReachedEmailData {
  videoTitle: string;
  limit: number;
  remaining: number;
  used: number;
  frontendUrl: string;
}

export interface SubscriptionExpiredEmailData {
  videoTitle: string;
  frontendUrl: string;
}

export interface EnhancedContent {
  hook: string;
  body: string;
  conclusion: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
}

export interface UpdatePostData {
  description?: string;
  keypoints?: string;
  scheduledFor?: Date;
  instagram_caption?: string;
  facebook_caption?: string;
  linkedin_caption?: string;
  twitter_caption?: string;
  tiktok_caption?: string;
  youtube_caption?: string;
}

export interface UserContext {
  name: string;
  position: string;
  companyName: string;
  city: string;
  socialHandles: string;
}

export interface VideoCreationData {
  prompt: string;
  avatar: string;
  name: string;
  position: string;
  companyName: string;
  license: string;
  tailoredFit: string;
  socialHandles: string;
  videoTopic: string;
  topicKeyPoints: string;
  city: string;
  preferredTone: string;
  language: string;
  zipCode: number;
  zipKeyPoints: string;
  callToAction: string;
  email: string;
  timestamp: string;
  requestId: string;
  isScheduled: boolean;
  scheduleId: string;
  trendIndex: number;
}

export interface VideoGenerationData {
  hook: string | undefined;
  body: string | undefined;
  conclusion: string | undefined;
  text: string;
  company_name: string;
  social_handles: string;
  license: string;
  email: string;
  avatar_title: string;
  avatar_body: string;
  avatar_conclusion: string;
  title: string;
  voice: string | undefined;
  isDefault: boolean | undefined;
  timestamp: string;
  isScheduled: boolean;
  scheduleId: string;
  trendIndex: number;
  _captions: any;
  language?: string;
  videoCaption: boolean;
  music?: string;
}

