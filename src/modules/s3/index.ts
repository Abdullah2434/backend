// ==================== S3 MODULE EXPORTS ====================

// Main service
export { S3Service, default as S3ServiceDefault } from "./services/s3.service";

// Individual services
export { S3ConfigService } from "./services/s3-config.service";
export { S3OperationsService } from "./services/s3-operations.service";

// Types
export * from "./types/s3.types";

// ==================== S3 MODULE CONFIGURATION ====================

export const s3ModuleConfig = {
  name: "S3 Module",
  version: "1.0.0",
  description: "AWS S3 service with upload, download, delete operations and batch processing",
  services: [
    "S3ConfigService",
    "S3OperationsService",
    "S3Service"
  ],
  features: [
    "S3 configuration management",
    "Video upload with signed URLs",
    "Video download with signed URLs",
    "Video deletion with security",
    "Batch upload and delete operations",
    "File information retrieval",
    "Health checks and monitoring",
    "Operation logging",
    "Secret key security",
    "Metadata management",
    "Content type validation",
    "Error handling and recovery"
  ],
  dependencies: [
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "crypto"
  ]
};

// ==================== CONVENIENCE EXPORTS ====================

// Create a singleton instance for easy importing
import { S3Service } from "./services/s3.service";

const s3Service = new S3Service();

// Export commonly used functions for backward compatibility
export const getS3 = () => s3Service;
export const generateS3Key = s3Service.generateS3Key.bind(s3Service);
export const uploadVideoDirectly = s3Service.uploadVideoDirectly.bind(s3Service);
export const createUploadUrl = s3Service.createUploadUrl.bind(s3Service);
export const createDownloadUrl = s3Service.createDownloadUrl.bind(s3Service);
export const deleteVideo = s3Service.deleteVideo.bind(s3Service);
export const getVideoUrl = s3Service.getVideoUrl.bind(s3Service);

// Export the singleton instance
export { s3Service };
