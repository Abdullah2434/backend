import { S3Client } from '@aws-sdk/client-s3';

// ==================== S3 CONFIGURATION TYPES ====================

export interface S3Config {
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export interface S3ServiceConfig {
  client: S3Client;
  bucketName: string;
  region: string;
}

// ==================== S3 OPERATION TYPES ====================

export interface VideoUploadResult {
  s3Key: string;
  secretKey: string;
  uploadUrl: string;
}

export interface VideoDownloadUrlResult {
  downloadUrl: string;
  expiresIn: number;
}

export interface S3UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  expiresIn?: number;
}

export interface S3DownloadOptions {
  expiresIn?: number;
  secretKey?: string;
}

export interface S3DeleteOptions {
  secretKey?: string;
}

// ==================== S3 FILE TYPES ====================

export interface S3FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
  etag?: string;
}

export interface S3UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ==================== S3 OPERATION RESULT TYPES ====================

export interface S3OperationResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

export interface S3UploadResult extends S3OperationResult {
  s3Key?: string;
  secretKey?: string;
  uploadUrl?: string;
}

export interface S3DownloadResult extends S3OperationResult {
  downloadUrl?: string;
  expiresIn?: number;
}

export interface S3DeleteResult extends S3OperationResult {
  deleted?: boolean;
}

// ==================== S3 HEALTH TYPES ====================

export interface S3HealthStatus {
  status: 'healthy' | 'unhealthy';
  connected: boolean;
  bucketAccessible: boolean;
  region: string;
  bucketName: string;
  lastCheck: Date;
  error?: string;
}

// ==================== S3 LOGGING TYPES ====================

export interface S3LogEntry {
  timestamp: Date;
  operation: 'upload' | 'download' | 'delete' | 'list' | 'head' | 'error';
  s3Key?: string;
  userId?: string;
  success: boolean;
  message: string;
  error?: string;
  duration?: number;
}

// ==================== S3 RATE LIMITING TYPES ====================

export interface S3RateLimit {
  maxRequestsPerMinute: number;
  maxUploadsPerMinute: number;
  maxDownloadsPerMinute: number;
  cooldownPeriod: number; // in seconds
}

export interface S3RateLimitStatus {
  canUpload: boolean;
  canDownload: boolean;
  canDelete: boolean;
  remainingUploads: number;
  remainingDownloads: number;
  resetTime: Date;
  isRateLimited: boolean;
}

// ==================== S3 SECURITY TYPES ====================

export interface S3SecurityConfig {
  requireSecretKey: boolean;
  allowedContentTypes: string[];
  maxFileSize: number; // in bytes
  allowedExtensions: string[];
}

export interface S3AccessControl {
  userId: string;
  s3Key: string;
  secretKey: string;
  permissions: ('read' | 'write' | 'delete')[];
  expiresAt?: Date;
}

// ==================== S3 BATCH OPERATION TYPES ====================

export interface S3BatchUploadItem {
  s3Key: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface S3BatchUploadResult {
  success: boolean;
  results: Array<{
    s3Key: string;
    success: boolean;
    error?: string;
  }>;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
}

export interface S3BatchDeleteItem {
  s3Key: string;
  secretKey?: string;
}

export interface S3BatchDeleteResult {
  success: boolean;
  results: Array<{
    s3Key: string;
    success: boolean;
    error?: string;
  }>;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
}

// ==================== S3 CACHE TYPES ====================

export interface S3CacheConfig {
  enabled: boolean;
  ttl: number; // time to live in seconds
  maxSize: number; // maximum cache size in MB
}

export interface S3CacheEntry {
  key: string;
  value: any;
  expiresAt: Date;
  size: number;
}

// ==================== S3 MONITORING TYPES ====================

export interface S3Metrics {
  totalUploads: number;
  totalDownloads: number;
  totalDeletes: number;
  totalErrors: number;
  averageUploadTime: number;
  averageDownloadTime: number;
  totalDataTransferred: number;
  lastActivity: Date;
}

export interface S3PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  s3Key?: string;
  fileSize?: number;
}
