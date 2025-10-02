import { IUser } from "../../../models/User";

export interface VideoMetadata {
  duration?: number;
  size?: number;
  format?: string;
  resolution?: string;
  [key: string]: any;
}

export interface Video {
  _id: string;
  videoId: string;
  userId: string;
  title: string;
  status: "processing" | "ready" | "failed";
  downloadUrl?: string;
  videoUrl?: string;
  metadata?: VideoMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoStats {
  totalCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
}

export interface VideoGenerationRequest {
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
  callToAction: string;
  email: string;
}

export interface GenerateVideoRequest {
  hook: string;
  body: string;
  conclusion: string;
  company_name: string;
  social_handles: string;
  license: string;
  avatar_title: string;
  avatar_body: string;
  avatar_conclusion: string;
  email: string;
  title: string;
}

export interface PhotoAvatarRequest {
  imagePath: string;
  age_group: string;
  name: string;
  gender: string;
  userId: string;
  ethnicity?: string;
  mimeType: string;
}

export interface DownloadVideoRequest {
  videoUrl: string;
  email: string;
  title: string;
  executionId?: string;
}

export interface WorkflowHistoryEntry {
  executionId: string;
  userId: string;
  email: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface TopicData {
  _id: string;
  topic: string;
  description: string;
  keyPoints: string[];
  createdAt: Date;
  updatedAt: Date;
}
