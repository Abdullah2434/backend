// ==================== TYPES ====================
export type PostStatus = "pending" | "completed" | "processing" | "failed";

export interface GeneratedTrend {
  description: string;
  keypoints: string;
  instagram_caption: string;
  facebook_caption: string;
  linkedin_caption: string;
  twitter_caption: string;
  tiktok_caption: string;
  youtube_caption: string;
  scheduledFor: Date;
  status: PostStatus;
  videoId?: string;
}

export interface FormattedPost {
  id: string;
  index: number;
  scheduleId: string;
  description: string;
  keypoints: string;
  scheduledFor: Date;
  status: PostStatus;
  scheduledForLocal: string;
  captions: {
    instagram: string;
    facebook: string;
    linkedin: string;
    twitter: string;
    tiktok: string;
    youtube: string;
  };
  videoId?: string;
}

export interface PostCounts {
  pending: number;
  completed: number;
  processing: number;
  failed: number;
}

export interface ScheduleInfo {
  frequency: string;
  days: string[];
  times: string[];
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  status: string;
  totalVideos: number;
  pendingVideos: number;
  completedVideos: number;
  processingVideos: number;
  failedVideos: number;
}

export interface UpdateData {
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
