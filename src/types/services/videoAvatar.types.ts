/**
 * Types for videoAvatar service
 */

import { IVideoAvatar } from "../../models/VideoAvatar";

export interface HeyGenSubmitPayload {
  training_footage_url: string;
  video_consent_url: string;
  avatar_name: string;
  callback_id?: string;
  callback_url?: string;
}

export interface HeyGenSubmitResponse {
  data?: {
    avatar_id?: string;
    avatar_name?: string;
    status?: string;
    preview_image_url?: string;
    preview_video_url?: string;
    default_voice_id?: string;
  };
  [key: string]: any;
}

export interface HeyGenPollingResponse {
  data?: {
    avatar_id?: string;
    avatar_name?: string;
    status?: "processing" | "completed" | "failed";
    preview_image_url?: string;
    preview_video_url?: string;
    default_voice_id?: string;
  };
  [key: string]: any;
}

export interface S3UploadResult {
  s3Key: string;
  signedUrl: string;
}

export interface FileUploadUrls {
  training_footage_url?: string;
  consent_statement_url?: string;
}

export interface AvatarUrls {
  trainingFootageUrl?: string;
  consentStatementUrl?: string;
  trainingFootageSignedUrl?: string;
  consentStatementSignedUrl?: string;
}

export interface DefaultAvatarData {
  avatar_id: string;
  avatar_name: string;
  default: boolean;
  userId?: string;
  status: "training";
  avatarType: "video_avatar";
  preview_image_url: string;
  preview_video_url?: string;
}

export interface VideoUrlValidationResult {
  trainingUrlValid: boolean;
  consentUrlValid: boolean;
  errors: string[];
}

export type FileType = "training_footage" | "consent_statement";

export type AvatarStatus = "processing" | "completed" | "failed";

export type UpdateAvatarStatus = "in_progress" | "completed" | "failed";

export interface NotificationPayload {
  avatar_id: string;
  avatar_group_id?: string;
  avatar_name?: string;
  message?: string;
  status?: string;
  preview_image_url?: string;
  preview_video_url?: string;
  default_voice_id?: string;
  error?: string;
}

