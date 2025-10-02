import { Worker } from "bullmq";
import axios from "axios";
import DefaultAvatar from "../../../../database/models/avatar";
import fs from "fs";
import { QueueConfigService } from "../services/queue-config.service";
import { notificationService } from "../../notification";
import {
  PhotoAvatarJobData,
  PhotoAvatarJobResult,
  PhotoAvatarProgress,
  QueueWorkerConfig,
  QueueWorkerError,
  JobPriority,
} from "../types/queue.types";

export class PhotoAvatarWorkerService {
  private worker!: Worker;
  private configService: QueueConfigService;
  private isRunning: boolean = false;
  private startTime: Date;

  // API Configuration
  private readonly API_KEY: string;
  private readonly UPLOAD_URL = "https://upload.heygen.com/v1/asset";
  private readonly AVATAR_GROUP_URL: string;
  private readonly TRAIN_URL: string;

  constructor() {
    this.configService = QueueConfigService.getInstance();
    this.startTime = new Date();

    // Initialize API configuration
    this.API_KEY = process.env.HEYGEN_API_KEY || "";
    this.AVATAR_GROUP_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/avatar_group/create`;
    this.TRAIN_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/train`;

    if (!this.API_KEY) {
      throw new QueueWorkerError(
        "photo-avatar-worker",
        "photo-avatar",
        "HEYGEN_API_KEY environment variable is required"
      );
    }

    this.initializeWorker();
  }

  private initializeWorker(): void {
    const config = this.configService.getQueueConfig("photo-avatar");
    if (!config) {
      throw new QueueWorkerError(
        "photo-avatar-worker",
        "photo-avatar",
        "Queue configuration not found"
      );
    }

    this.worker = new Worker(
      "photo-avatar",
      this.processPhotoAvatarJob.bind(this),
      {
        connection: config.connection,
        concurrency: 2, // Reduced to 2 to avoid overwhelming Redis
        // BullMQ worker settings
        stalledInterval: 300000, // 5 minutes - time before considering a job stalled
        maxStalledCount: 1, // Number of times a job can be stalled before failing
      }
    );

    this.setupEventHandlers();
    console.log("✅ Photo Avatar Worker initialized");
  }

  private setupEventHandlers(): void {
    this.worker.on("ready", () => {
      this.isRunning = true;
      console.log("🚀 Photo Avatar Worker ready");
      console.log(`📊 Worker concurrency: 2, stalledInterval: 5 minutes`);
    });

    this.worker.on("error", (error) => {
      console.error("❌ Photo Avatar Worker error:", error);
      // Log additional context for timeout errors
      if (error.message.includes("Command timed out")) {
        console.error(
          "🔍 Redis timeout detected - this may indicate long-running operations"
        );
        console.error("💡 Current Redis commandTimeout: 120000ms (2 minutes)");
        console.error("💡 Current jobTimeout: 600000ms (10 minutes)");
        console.error(
          "💡 Consider checking Redis server performance or network connectivity"
        );
      } else if (error.message.includes("Connection is closed")) {
        console.error("🔍 Redis connection lost - attempting to reconnect");
      } else if (error.message.includes("ECONNREFUSED")) {
        console.error(
          "🔍 Redis server connection refused - check if Redis is running"
        );
      }
    });

    this.worker.on("failed", (job, err) => {
      console.error(
        `❌ Photo Avatar Worker job failed: ${job?.id}`,
        err.message
      );
    });

    this.worker.on("completed", (job) => {
      console.log(`✅ Photo Avatar Worker job completed: ${job.id}`);
    });

    this.worker.on("stalled", (jobId) => {
      console.warn(`⚠️ Photo Avatar Worker job stalled: ${jobId}`);
    });

    this.worker.on("progress", (job, progress) => {
      console.log(
        `📊 Photo Avatar Worker job progress: ${job.id} - ${progress}%`
      );
    });
  }

  private async processPhotoAvatarJob(job: any): Promise<PhotoAvatarJobResult> {
    const startTime = Date.now();
    const { imagePath, age_group, name, gender, userId, ethnicity, mimeType } =
      job.data as PhotoAvatarJobData;

    try {
      console.log(
        `🔄 Processing photo avatar job: ${job.id} for user ${userId}`
      );
      console.log(`⏱️ Job started at: ${new Date().toISOString()}`);
      console.log(
        `📊 Job timeout: 10 minutes, Redis command timeout: 2 minutes`
      );

      // Step 1: Upload image to HeyGen
      await this.updateProgress(job, "upload", "progress", {
        message: "Uploading your photo to HeyGen...",
        progress: 10,
      });

      const uploadResult = await this.uploadImageToHeyGen(imagePath, mimeType);
      console.log(`📤 Image uploaded successfully: ${uploadResult.asset_id}`);

      // Step 2: Create avatar group
      await this.updateProgress(job, "create_group", "progress", {
        message: "Creating avatar group...",
        progress: 30,
      });

      const avatarGroupResult = await this.createAvatarGroup(
        uploadResult.asset_id,
        {
          age_group,
          name,
          gender,
          ethnicity,
        }
      );
      console.log(
        `👥 Avatar group created: ${avatarGroupResult.avatar_group_id}`
      );

      // Step 3: Start training
      await this.updateProgress(job, "train", "progress", {
        message: "Starting avatar training...",
        progress: 50,
      });

      const trainResult = await this.startAvatarTraining(
        avatarGroupResult.avatar_group_id
      );
      console.log(`🎓 Avatar training started: ${trainResult.avatar_id}`);

      // Step 4: Save to database
      await this.saveAvatarToDatabase({
        avatar_id: trainResult.avatar_id,
        avatar_name: name,
        gender,
        ethnicity,
        age_group,
        userId,
        status: "pending",
      });

      // Step 5: Complete
      await this.updateProgress(job, "complete", "success", {
        message: "Avatar training started successfully!",
        progress: 100,
      });

      const duration = Date.now() - startTime;
      console.log(
        `✅ Photo avatar job completed successfully: ${job.id} (${duration}ms)`
      );

      return {
        success: true,
        avatarId: trainResult.avatar_id,
        avatarUrl: avatarGroupResult.avatar_group_id,
        status: "pending",
        duration,
        data: {
          assetId: uploadResult.asset_id,
          avatarGroupId: avatarGroupResult.avatar_group_id,
          trainingStarted: true,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ Photo avatar job failed: ${job.id}`, error.message);

      // Notify user of failure
      await this.notifyUserFailure(userId, error.message);

      return {
        success: false,
        error: error.message,
        duration,
        status: "failed",
      };
    }
  }

  private async uploadImageToHeyGen(
    imagePath: string,
    mimeType: string
  ): Promise<{ asset_id: string }> {
    try {
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await axios.post(this.UPLOAD_URL, imageBuffer, {
        headers: {
          "x-api-key": this.API_KEY,
          "Content-Type": mimeType || "image/jpeg",
        },
        timeout: 30000, // 30 second timeout
      });

      if (!response.data?.asset_id) {
        throw new Error("Invalid response from HeyGen upload API");
      }

      return response.data;
    } catch (error: any) {
      console.error("HeyGen upload request failed:", error);

      let errorCode = "upload_failed";
      let userFriendlyMessage =
        "Failed to upload image to HeyGen. Please try again.";

      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          errorCode = "unauthorized";
          userFriendlyMessage = "Invalid API key. Please contact support.";
        } else if (status === 413) {
          errorCode = "file_too_large";
          userFriendlyMessage =
            "Image file is too large. Please use a smaller image.";
        } else if (status === 415) {
          errorCode = "unsupported_format";
          userFriendlyMessage =
            "Unsupported image format. Please use JPEG or PNG.";
        } else if (status >= 500) {
          errorCode = "server_error";
          userFriendlyMessage =
            "HeyGen service is temporarily unavailable. Please try again later.";
        }
      } else if (error.code === "ECONNABORTED") {
        errorCode = "timeout";
        userFriendlyMessage =
          "Upload timed out. Please check your internet connection and try again.";
      } else if (error.code === "ENOENT") {
        errorCode = "file_not_found";
        userFriendlyMessage =
          "Image file not found. Please try uploading again.";
      }

      throw new Error(`${errorCode}: ${userFriendlyMessage}`);
    }
  }

  private async createAvatarGroup(
    assetId: string,
    metadata: {
      age_group: string;
      name: string;
      gender: string;
      ethnicity: string;
    }
  ): Promise<{ avatar_group_id: string }> {
    try {
      const response = await axios.post(
        this.AVATAR_GROUP_URL,
        {
          asset_id: assetId,
          avatar_group_name: metadata.name,
          gender: metadata.gender,
          age_group: metadata.age_group,
          ethnicity: metadata.ethnicity,
        },
        {
          headers: {
            "x-api-key": this.API_KEY,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (!response.data?.data?.avatar_group_id) {
        throw new Error("Invalid response from HeyGen avatar group API");
      }

      return response.data.data;
    } catch (error: any) {
      console.error("HeyGen avatar group creation failed:", error);

      let userFriendlyMessage =
        "Failed to create avatar group. Please try again.";

      if (error.response?.status === 400) {
        userFriendlyMessage =
          "Invalid image or metadata. Please check your image and try again.";
      } else if (error.response?.status === 401) {
        userFriendlyMessage = "Invalid API key. Please contact support.";
      } else if (error.response?.status >= 500) {
        userFriendlyMessage =
          "HeyGen service is temporarily unavailable. Please try again later.";
      }

      throw new Error(`avatar_group_creation_failed: ${userFriendlyMessage}`);
    }
  }

  private async startAvatarTraining(
    avatarGroupId: string
  ): Promise<{ avatar_id: string }> {
    try {
      const response = await axios.post(
        this.TRAIN_URL,
        {
          avatar_group_id: avatarGroupId,
        },
        {
          headers: {
            "x-api-key": this.API_KEY,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (!response.data?.data?.avatar_id) {
        throw new Error("Invalid response from HeyGen training API");
      }

      return response.data.data;
    } catch (error: any) {
      console.error("HeyGen avatar training failed:", error);

      let userFriendlyMessage =
        "Failed to start avatar training. Please try again.";

      if (error.response?.status === 400) {
        userFriendlyMessage =
          "Invalid avatar group. Please try creating a new avatar.";
      } else if (error.response?.status === 401) {
        userFriendlyMessage = "Invalid API key. Please contact support.";
      } else if (error.response?.status >= 500) {
        userFriendlyMessage =
          "HeyGen service is temporarily unavailable. Please try again later.";
      }

      throw new Error(`training_failed: ${userFriendlyMessage}`);
    }
  }

  private async saveAvatarToDatabase(avatarData: {
    avatar_id: string;
    avatar_name: string;
    gender: string;
    ethnicity: string;
    age_group: string;
    userId: string;
    status: string;
  }): Promise<void> {
    try {
      await DefaultAvatar.create({
        avatar_id: avatarData.avatar_id,
        avatar_name: avatarData.avatar_name,
        gender: avatarData.gender,
        ethnicity: avatarData.ethnicity,
        age_group: avatarData.age_group,
        userId: avatarData.userId,
        status: avatarData.status,
        default: false,
      });

      console.log(`💾 Avatar saved to database: ${avatarData.avatar_id}`);
    } catch (error: any) {
      console.error("Failed to save avatar to database:", error);
      throw new Error(
        `database_save_failed: Failed to save avatar to database: ${error.message}`
      );
    }
  }

  private async updateProgress(
    job: any,
    step: PhotoAvatarProgress["step"],
    status: PhotoAvatarProgress["status"],
    data: any
  ): Promise<void> {
    try {
      const progressData: PhotoAvatarProgress = {
        step,
        status,
        message: data.message || "",
        progress: data.progress || 0,
        data,
      };

      await job.updateProgress(progressData);

      // Notify user via WebSocket
      if (job.data.userId) {
        notificationService.notifyPhotoAvatarProgress(
          job.data.userId,
          step,
          status,
          data
        );
      }
    } catch (error: any) {
      console.error("Failed to update job progress:", error);
    }
  }

  private async notifyUserFailure(
    userId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      notificationService.notifyPhotoAvatarProgress(userId, "error", "error", {
        message: "Avatar creation failed. Please try again.",
        error: errorMessage,
      });
    } catch (error: any) {
      console.error("Failed to notify user of failure:", error);
    }
  }

  // ==================== WORKER MANAGEMENT ====================

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Photo Avatar Worker is already running");
      return;
    }

    await this.worker.waitUntilReady();
    this.isRunning = true;
    console.log("🚀 Photo Avatar Worker started");
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("Photo Avatar Worker is not running");
      return;
    }

    await this.worker.close();
    this.isRunning = false;
    console.log("🛑 Photo Avatar Worker stopped");
  }

  public async pause(): Promise<void> {
    await this.worker.pause();
    console.log("⏸️ Photo Avatar Worker paused");
  }

  public async resume(): Promise<void> {
    await this.worker.resume();
    console.log("▶️ Photo Avatar Worker resumed");
  }

  // ==================== WORKER STATUS ====================

  public isWorkerRunning(): boolean {
    return this.isRunning;
  }

  public getWorkerInfo(): {
    name: string;
    isRunning: boolean;
    isPaused: boolean;
    concurrency: number;
    processed: number;
    failed: number;
    stalled: number;
    uptime: number;
  } {
    return {
      name: "photo-avatar-worker",
      isRunning: this.isRunning,
      isPaused: this.worker.isPaused(),
      concurrency: this.worker.opts.concurrency || 1,
      processed: 0, // Would need to track this
      failed: 0, // Would need to track this
      stalled: 0, // Would need to track this
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  public getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  public async healthCheck(): Promise<{
    status: "healthy" | "unhealthy" | "degraded";
    isRunning: boolean;
    isPaused: boolean;
    uptime: number;
    lastActivity?: Date;
  }> {
    try {
      const isRunning = this.isRunning;
      const isPaused = this.worker.isPaused();
      const uptime = this.getUptime();

      let status: "healthy" | "unhealthy" | "degraded" = "healthy";

      if (!isRunning) {
        status = "unhealthy";
      } else if (isPaused) {
        status = "degraded";
      }

      return {
        status,
        isRunning,
        isPaused,
        uptime,
      };
    } catch (error: any) {
      console.error("Worker health check failed:", error);
      return {
        status: "unhealthy",
        isRunning: false,
        isPaused: false,
        uptime: this.getUptime(),
      };
    }
  }
}

export default PhotoAvatarWorkerService;
