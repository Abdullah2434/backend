import { S3ConfigService } from './s3-config.service';
import { S3OperationsService } from './s3-operations.service';
import {
  S3Config,
  VideoUploadResult,
  VideoDownloadUrlResult,
  S3UploadOptions,
  S3DownloadOptions,
  S3DeleteOptions,
  S3OperationResult,
  S3UploadResult,
  S3DownloadResult,
  S3DeleteResult,
  S3FileInfo,
  S3HealthStatus,
  S3LogEntry,
  S3BatchUploadItem,
  S3BatchUploadResult,
  S3BatchDeleteItem,
  S3BatchDeleteResult,
} from '../types/s3.types';

export class S3Service {
  private configService: S3ConfigService;
  private operationsService: S3OperationsService;

  constructor(config?: Partial<S3Config>) {
    this.configService = new S3ConfigService(config);
    const serviceConfig = this.configService.getServiceConfig();
    this.operationsService = new S3OperationsService(serviceConfig);
  }

  // ==================== CONFIGURATION METHODS ====================

  public getConfig(): S3Config {
    return this.configService.getConfig();
  }

  public isConfigured(): boolean {
    return this.configService.isConfigured();
  }

  public getConfigurationStatus() {
    return this.configService.getConfigurationStatus();
  }

  public updateConfig(newConfig: Partial<S3Config>): void {
    this.configService.updateConfig(newConfig);
    // Recreate operations service with new config
    const serviceConfig = this.configService.getServiceConfig();
    this.operationsService = new S3OperationsService(serviceConfig);
  }

  // ==================== CORE OPERATION METHODS ====================

  public generateS3Key(userId: string, videoId: string, filename: string): string {
    return this.operationsService.generateS3Key(userId, videoId, filename);
  }

  public async uploadVideoDirectly(
    s3Key: string,
    buffer: Buffer,
    contentType: string,
    metadata: Record<string, string> = {}
  ): Promise<S3UploadResult> {
    return await this.operationsService.uploadVideoDirectly(s3Key, buffer, contentType, metadata);
  }

  public async createUploadUrl(
    userId: string,
    videoId: string,
    filename: string,
    contentType: string = 'video/mp4'
  ): Promise<VideoUploadResult> {
    const options: S3UploadOptions = { contentType };
    return await this.operationsService.createUploadUrl(userId, videoId, filename, options);
  }

  public async createDownloadUrl(
    s3Key: string,
    secretKey: string,
    expiresIn: number = 3600
  ): Promise<VideoDownloadUrlResult> {
    const options: S3DownloadOptions = { expiresIn, secretKey };
    return await this.operationsService.createDownloadUrl(s3Key, secretKey, options);
  }

  public async deleteVideo(s3Key: string, secretKey: string): Promise<S3DeleteResult> {
    const options: S3DeleteOptions = { secretKey };
    return await this.operationsService.deleteVideo(s3Key, options);
  }

  public async getFileInfo(s3Key: string): Promise<S3FileInfo | null> {
    return await this.operationsService.getFileInfo(s3Key);
  }

  public getVideoUrl(s3Key: string): string {
    return this.operationsService.getVideoUrl(s3Key);
  }

  // ==================== BATCH OPERATION METHODS ====================

  public async batchUpload(items: S3BatchUploadItem[]): Promise<S3BatchUploadResult> {
    return await this.operationsService.batchUpload(items);
  }

  public async batchDelete(items: S3BatchDeleteItem[]): Promise<S3BatchDeleteResult> {
    return await this.operationsService.batchDelete(items);
  }

  // ==================== UTILITY METHODS ====================

  public getBucketName(): string {
    return this.configService.getBucketName();
  }

  public getRegion(): string {
    return this.configService.getRegion();
  }

  public getEndpoint(): string | undefined {
    return this.configService.getEndpoint();
  }

  public isForcePathStyle(): boolean {
    return this.configService.isForcePathStyle();
  }

  // ==================== LOGGING METHODS ====================

  public getLogs(limit: number = 100): S3LogEntry[] {
    return this.operationsService.getLogs(limit);
  }

  public clearLogs(): void {
    this.operationsService.clearLogs();
  }

  // ==================== HEALTH CHECK ====================

  public async healthCheck(): Promise<S3HealthStatus> {
    const startTime = Date.now();
    
    try {
      const configStatus = this.configService.getConfigurationStatus();
      
      if (!configStatus.configured) {
        return {
          status: 'unhealthy',
          connected: false,
          bucketAccessible: false,
          region: configStatus.region,
          bucketName: configStatus.bucketName,
          lastCheck: new Date(),
          error: 'S3 configuration is incomplete',
        };
      }

      // Test bucket access by trying to list objects (with limit 1)
      try {
        const testKey = 'health-check-test';
        await this.operationsService.getFileInfo(testKey);
        // If we get here without error, bucket is accessible
      } catch (error: any) {
        // If it's a "not found" error, that's actually good - means bucket is accessible
        if (!error.message.includes('NoSuchKey') && !error.message.includes('not found')) {
          throw error;
        }
      }

      return {
        status: 'healthy',
        connected: true,
        bucketAccessible: true,
        region: configStatus.region,
        bucketName: configStatus.bucketName,
        lastCheck: new Date(),
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        connected: false,
        bucketAccessible: false,
        region: this.configService.getRegion(),
        bucketName: this.configService.getBucketName(),
        lastCheck: new Date(),
        error: error.message,
      };
    }
  }

  // ==================== LEGACY COMPATIBILITY METHODS ====================

  // These methods maintain backward compatibility with the old S3Service interface
  public async uploadVideoDirectlyLegacy(s3Key: string, buf: Buffer, contentType: string, metadata: Record<string, string>) {
    const result = await this.uploadVideoDirectly(s3Key, buf, contentType, metadata);
    return result.success;
  }

  public async createUploadUrlLegacy(userId: string, videoId: string, filename: string, contentType = 'video/mp4'): Promise<VideoUploadResult> {
    return await this.createUploadUrl(userId, videoId, filename, contentType);
  }

  public async createDownloadUrlLegacy(s3Key: string, secretKey: string, expiresIn = 3600): Promise<VideoDownloadUrlResult> {
    return await this.createDownloadUrl(s3Key, secretKey, expiresIn);
  }

  public async deleteVideoLegacy(s3Key: string, secretKey: string) {
    const result = await this.deleteVideo(s3Key, secretKey);
    return result.success;
  }
}

export default S3Service;
