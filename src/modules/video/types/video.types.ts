// ==================== VIDEO MODULE TYPES ====================

import { Request } from "express";

// ==================== REQUEST TYPES ====================

export interface VideoGalleryRequest extends Request {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface VideoDeleteRequest extends Request {
  body: {
    videoId: string;
  };
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface VideoDownloadRequest extends Request {
  body: {
    videoUrl: string;
    email: string;
    title: string;
    executionId?: string;
  };
}

export interface VideoStatusRequest extends Request {
  body: {
    videoId: string;
    status: "processing" | "ready" | "failed";
    metadata?: any;
  };
}

export interface VideoCreateRequest extends Request {
  body: {
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
  };
}

export interface VideoGenerateRequest extends Request {
  body: {
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
  };
}

export interface VideoDownloadProxyRequest extends Request {
  query: {
    url: string;
  };
}

export interface VideoAvatarRequest extends Request {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface VideoVoiceRequest extends Request {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface VideoPhotoAvatarRequest extends Request {
  body: {
    age_group: string;
    name: string;
    gender: string;
    userId: string;
    ethnicity?: string;
  };
  file?: Express.Multer.File;
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface VideoPendingWorkflowsRequest extends Request {
  params: {
    userId: string;
  };
}

export interface VideoTrackExecutionRequest extends Request {
  body: {
    executionId: string;
    email: string;
  };
}

export interface VideoTopicRequest extends Request {
  params: {
    topic: string;
  };
}

export interface VideoTopicByIdRequest extends Request {
  params: {
    id: string;
  };
}

// ==================== RESPONSE TYPES ====================

export interface VideoResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface VideoGalleryResponse {
  success: boolean;
  message: string;
  data: {
    videos: VideoItem[];
    totalCount: number;
    readyCount: number;
    processingCount: number;
    failedCount: number;
  };
}

export interface VideoItem {
  id: string;
  videoId: string;
  title: string;
  status: "processing" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
  metadata?: any;
  downloadUrl?: string;
  videoUrl?: string;
}

export interface VideoStats {
  totalCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
}

export interface VideoDownloadResponse {
  success: boolean;
  message: string;
  data: {
    videoId: string;
    title: string;
    size: number;
    downloadUrl: string;
  };
}

export interface VideoStatusResponse {
  success: boolean;
  message: string;
  data: {
    videoId: string;
    status: string;
    updatedAt: string;
  };
}

export interface VideoCreateResponse {
  success: boolean;
  message: string;
  data: {
    requestId: string;
    webhookResponse: any;
    timestamp: string;
    status: string;
  };
}

export interface VideoGenerateResponse {
  success: boolean;
  message: string;
  data: {
    status: string;
    timestamp: string;
    estimated_completion: string;
    note: string;
  };
}

export interface VideoAvatarResponse {
  success: boolean;
  message: string;
  data: {
    customAvatars: AvatarItem[];
    defaultAvatars: AvatarItem[];
  };
}

export interface VideoVoiceResponse {
  success: boolean;
  message: string;
  data: {
    customVoices: VoiceItem[];
    defaultVoices: VoiceItem[];
  };
}

export interface AvatarItem {
  _id: string;
  avatar_id: string;
  name: string;
  gender: string;
  age_group: string;
  ethnicity?: string;
  default: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceItem {
  _id: string;
  voice_id: string;
  name: string;
  gender: string;
  language: string;
  default: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoPendingWorkflowsResponse {
  success: boolean;
  message: string;
  data: {
    hasPendingWorkflows: boolean;
    pendingCount: number;
    message?: string;
    workflows?: Array<{
      executionId: string;
      createdAt: string;
      email: string;
    }>;
  };
}

export interface VideoTrackExecutionResponse {
  success: boolean;
  message: string;
  data: {
    executionId: string;
    userId: string;
    email: string;
    timestamp: string;
  };
}

export interface VideoTopicResponse {
  success: boolean;
  message: string;
  data: any;
}

// ==================== VIDEO DATA TYPES ====================

export interface VideoData {
  videoId: string;
  title: string;
  status: "processing" | "ready" | "failed";
  userId: string;
  metadata?: any;
  downloadUrl?: string;
  videoUrl?: string;
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
  callToAction: string;
  email: string;
}

export interface VideoGenerationData {
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

export interface VideoDownloadData {
  videoUrl: string;
  email: string;
  title: string;
  executionId?: string;
}

export interface VideoStatusData {
  videoId: string;
  status: "processing" | "ready" | "failed";
  metadata?: any;
}

export interface PhotoAvatarData {
  age_group: string;
  name: string;
  gender: string;
  userId: string;
  ethnicity?: string;
  imagePath: string;
  mimeType: string;
}

// ==================== CONFIGURATION TYPES ====================

export interface VideoConfig {
  webhookUrl: string;
  generateWebhookUrl: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
  maxVideoSize: number;
  maxTitleLength: number;
  maxPromptLength: number;
}

// ==================== ERROR TYPES ====================

export class VideoError extends Error {
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "VIDEO_ERROR"
  ) {
    super(message);
    this.name = "VideoError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends VideoError {
  field?: string;

  constructor(
    message: string,
    field?: string,
    statusCode: number = 400,
    code: string = "VALIDATION_ERROR"
  ) {
    super(message, statusCode, code);
    this.field = field;
  }
}

export class AuthenticationError extends VideoError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends VideoError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends VideoError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND_ERROR");
  }
}

export class RateLimitError extends VideoError {
  constructor(message: string = "Too many requests. Please try again later.") {
    super(message, 429, "RATE_LIMIT_ERROR");
  }
}

export class WebhookError extends VideoError {
  constructor(message: string = "Webhook request failed") {
    super(message, 502, "WEBHOOK_ERROR");
  }
}

// ==================== UTILITY TYPES ====================

export interface VideoStats {
  totalCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
}

export interface VideoAnalytics {
  mostPopularTopics: Array<{
    topic: string;
    count: number;
  }>;
  videosByStatus: Array<{
    status: string;
    count: number;
  }>;
  averageProcessingTime: number;
  totalStorageUsed: number;
}

export interface VideoMiddlewareConfig {
  rateLimitWindow: number;
  rateLimitMax: number;
  enableLogging: boolean;
  enableAnalytics: boolean;
  requireAuth: boolean;
}

// ==================== VALIDATION TYPES ====================

export interface VideoValidationRules {
  videoId: {
    required: boolean;
    pattern: RegExp;
  };
  title: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  prompt: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  email: {
    required: boolean;
    pattern: RegExp;
    maxLength: number;
  };
  executionId: {
    required: boolean;
    pattern: RegExp;
  };
}
