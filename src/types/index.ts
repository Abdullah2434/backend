import { Request } from "express";

// ==================== SOCIALBU TYPES ====================
export interface SocialBuAccount {
  id: number;
  name: string;
  type: string;
  _type: string;
  active: boolean;
  image: string;
  post_maxlength: number;
  attachment_types: string[];
  max_attachments: number;
  post_media_required: boolean;
  video_dimensions: {
    min: [number, number | null];
    max: [number | null, number | null];
  };
  video_duration: {
    min: number;
    max: number;
  };
  user_id: number;
  account_id: string;
  public_id: string;
  extra_data: any;
}

export interface SocialBuApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
}

// ==================== AUTH TYPES ====================
export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ResetPasswordData {
  resetToken: string;
  newPassword: string;
}

export interface GoogleUserData {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  user: any;
  accessToken: string;
}

export interface GoogleAuthResult {
  user: any;
  accessToken: string;
  isNewUser: boolean;
}

// ==================== SUBSCRIPTION TYPES ====================
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  videoLimit: number;
  stripePriceId: string;
  features: string[];
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: "active" | "canceled" | "past_due" | "unpaid" | "pending";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  videoCount: number;
  videoLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionData {
  userId: string;
  planId: string;
  paymentMethodId: string;
}

export interface CreatePaymentIntentData {
  userId: string;
  planId: string;
  customerEmail: string;
  customerName: string;
}

export interface UpdateSubscriptionData {
  subscriptionId: string;
  planId?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface PaymentMethodData {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

// Enhanced Card Management Types
export interface CardInfo {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  isExpired: boolean;
}

export interface SetupIntentData {
  setupIntent: {
    id: string;
    client_secret: string;
    status: string;
  };
  customer: {
    id: string;
  };
}

export interface UpdatePaymentMethodRequest {
  setupIntentId: string;
  setAsDefault?: boolean;
}

export interface BillingData {
  userId: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "canceled" | "open";
  stripeInvoiceId: string;
  stripePaymentIntentId?: string;
  description: string;
  createdAt: Date;
}

// ==================== VIDEO TYPES ====================
export interface CreateVideoData {
  email: string;
  title: string;
  s3Key: string;
  videoUrl: string;
  secretKey?: string;
  status?: "processing" | "ready" | "failed";
  metadata?: VideoMetadata;
}

export interface UpdateVideoData {
  title?: string;
  status?: "processing" | "ready" | "failed";
  metadata?: Partial<VideoMetadata>;
}

export interface VideoMetadata {
  duration?: number;
  size?: number;
  format?: string;
}

export interface VideoStats {
  totalCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
}

export interface VideoDownloadResult {
  videoId: string;
  title: string;
  s3Key: string;
  status: string;
  size: number;
  createdAt: Date;
}

// ==================== S3 TYPES ====================
export interface S3Config {
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export interface VideoUploadResult {
  s3Key: string;
  secretKey: string;
  uploadUrl: string;
}

export interface VideoDownloadUrlResult {
  downloadUrl: string;
  expiresIn: number;
}

// ==================== EMAIL TYPES ====================
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// ==================== WEBHOOK TYPES ====================
export interface VideoCompleteData {
  videoId: string;
  status?: string;
  s3Key?: string;
  metadata?: any;
  error?: any;
  scheduleId?: string;
  trendIndex?: number;
  captions?: {
    instagram_caption?: string;
    facebook_caption?: string;
    linkedin_caption?: string;
    twitter_caption?: string;
    tiktok_caption?: string;
  };
}

export interface WebhookResult {
  success: boolean;
  message: string;
  data?: any;
}

// ==================== API RESPONSE TYPES ====================
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isEmailVerified: boolean;
  googleId?: string;
  subscription?: UserSubscription;
}

export interface VideoResponse {
  id: string;
  videoId: string;
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: VideoMetadata;
  downloadUrl?: string | null;
}

// ==================== JWT TYPES ====================
export interface JwtPayload {
  userId: string;
  email: string;
  type?: "reset";
}

// ==================== DATABASE TYPES ====================
export interface DatabaseConfig {
  uri: string;
  options?: any;
}

// ==================== REQUEST/RESPONSE TYPES ====================
export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface HealthResponse {
  status: string;
}

// ==================== MIDDLEWARE TYPES ====================
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

export interface CorsConfig {
  origin: string | string[];
  credentials: boolean;
}

// ==================== VALIDATION TYPES ====================
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ==================== LOGGING TYPES ====================
export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: any;
}

// ==================== VIDEO AVATAR TYPES ====================
export interface CreateVideoAvatarRequest {
  training_footage_url?: string;
  consent_statement_url?: string;
  avatar_name: string;
  avatar_group_id?: string;
  callback_id?: string;
  callback_url?: string;
}

export interface CreateVideoAvatarWithFilesRequest {
  avatar_name: string;
  avatar_group_id?: string;
  callback_id?: string;
  callback_url?: string;
  training_footage_file?: Express.Multer.File;
  consent_statement_file?: Express.Multer.File;
}

export interface CreateVideoAvatarResponse {
  avatar_id: string;
  avatar_group_id: string;
  status?: string;
  message?: string;
  preview_image_url?: string;
  preview_video_url?: string;
  default_voice_id?: string;
  avatar_name?: string;
  error?: string;
}

export interface VideoAvatarStatusResponse {
  avatar_id: string;
  status: "in_progress"| "training" | "ready" | "processing" | "completed" | "failed";
  avatar_group_id: string;
  error?: string;
  message?: string;
  loading?: boolean;
  avatar_name?: string;
  completedAt?: Date;
  preview_image_url?: string;
  preview_video_url?: string;
  default_voice_id?: string;
  [key: string]: any; // For other avatar details
}

export interface VideoAvatarCallbackPayload {
  avatar_id: string;
  status: "completed" | "failed";
  avatar_group_id: string;
  callback_id?: string;
  user_id?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface WebhookRequest {
  avatar_id: string;
  status: "completed" | "failed";
  avatar_group_id: string;
  callback_id?: string;
  user_id?: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface VideoAvatarData {
  avatar_id: string;
  avatar_group_id: string;
  avatar_name: string;
  training_footage_url: string;
  consent_statement_url: string;
  status: "processing" | "completed" | "failed";
  callback_id?: string;
  callback_url?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// ==================== ENVIRONMENT TYPES ====================
export interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: string;
  MONGODB_URI: string;
  JWT_SECRET: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  EMAIL_HOST: string;
  EMAIL_PORT: string;
  EMAIL_USER: string;
  EMAIL_PASS: string;
  FRONTEND_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}

// ==================== DYNAMIC POST TYPES ====================
export * from "./dynamicPost.types";

// ==================== ELEVENLABS TYPES ====================
export * from "./elevenLabs.types";

// ==================== ENERGY PROFILE TYPES ====================
export * from "./energyProfile.types";

// ==================== MUSIC TYPES ====================
export * from "./music.types";
