import VideoAvatar, { IVideoAvatar } from "../../models/VideoAvatar";
import DefaultAvatar, { IDefaultAvatar } from "../../models/avatar";
import { getS3 } from "../s3.service";
import { WebhookService } from "../webhook";
import { notificationService } from "../notification.service";
import {
  CreateVideoAvatarWithFilesRequest,
  CreateVideoAvatarResponse,
  VideoAvatarStatusResponse,
  VideoAvatarData,
  WebhookRequest,
} from "../../types";
import {
  heyGenSubmitPayloadSchema,
  heyGenResponseSchema,
  POLLING_INTERVAL_MS,
  S3_SIGNED_URL_EXPIRATION_SECONDS,
  DEFAULT_VIDEO_AVATAR_STATUS,
  DEFAULT_VIDEO_AVATAR_TYPE,
} from "../../validations/videoAvatarService.validations";
import {
  HeyGenSubmitPayload,
  HeyGenSubmitResponse,
  HeyGenPollingResponse,
  S3UploadResult,
  FileUploadUrls,
  AvatarUrls,
  DefaultAvatarData,
  VideoUrlValidationResult,
  FileType,
  UpdateAvatarStatus,
} from "../../types/services/videoAvatar.types";
import {
  generateAvatarId,
  generateAvatarGroupId,
  isS3Url,
  extractS3KeyFromUrl,
  validateHeyGenConfig,
  isValidFileType,
  isValidUpdateAvatarStatus,
  generateS3Key,
  formatNotificationPayload,
} from "../../utils/videoAvatarHelpers";

// ==================== CONSTANTS ====================
const HEYGEN_VIDEO_AVATAR_ENDPOINT = "/video_avatar";

export class VideoAvatarService {
  private s3Service = getS3();
  private webhookService = new WebhookService();

  /**
   * Generate signed URL for S3 file
   */
  private async generateSignedUrlForS3File(
    url: string
  ): Promise<string | null> {
    if (!isS3Url(url)) {
      return url;
    }

    const s3Key = extractS3KeyFromUrl(url);
    if (!s3Key) {
      return url;
    }

    try {
      const result = await this.s3Service.createVideoViewUrl(
        s3Key,
        undefined,
        S3_SIGNED_URL_EXPIRATION_SECONDS
      );
      return result.viewUrl;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      return url;
    }
  }

  /**
   * Upload file to S3 and return both S3 key and signed URL for external access
   */
  private async uploadFileToS3WithSignedUrl(
    file: Express.Multer.File,
    avatarId: string,
    fileType: FileType
  ): Promise<S3UploadResult> {
    try {
      if (!isValidFileType(fileType)) {
        throw new Error(`Invalid file type: ${fileType}`);
      }

      // Generate S3 key for the file
      const filename = file.originalname || `${fileType}.mp4`;
      const s3Key = generateS3Key(avatarId, fileType, filename);

      // Upload file to S3 using file path (streaming for large files)
      await this.s3Service.uploadVideoFromPath(
        s3Key,
        file.path, // Use file.path for disk storage
        file.mimetype,
        {
          avatarId,
          fileType,
          uploadedAt: new Date().toISOString(),
          originalName: file.originalname,
        }
      );

      // Generate view URL for external access (valid for 24 hours)
      const result = await this.s3Service.createVideoViewUrl(
        s3Key,
        undefined,
        S3_SIGNED_URL_EXPIRATION_SECONDS
      );

      return { s3Key, signedUrl: result.viewUrl };
    } catch (error: any) {
      console.error(
        `Error uploading ${fileType} to S3:`,
        error?.message || error
      );
      throw new Error(
        `Failed to upload ${fileType} to S3: ${
          error?.message || "Unknown error"
        }`
      );
    }
  }

  /**
   * Validate video URLs are accessible
   */
  private async validateVideoUrls(
    trainingUrl: string,
    consentUrl: string
  ): Promise<VideoUrlValidationResult> {
    const errors: string[] = [];

    try {
      // Check if URLs are valid
      const trainingResponse = await fetch(trainingUrl, { method: "HEAD" });
      if (!trainingResponse.ok) {
        errors.push(
          `Training footage URL is not accessible: ${trainingResponse.status}`
        );
      } else {
        // Validate content type
        const trainingContentType =
          trainingResponse.headers.get("content-type");
        if (!trainingContentType?.includes("video/")) {
          errors.push("Training footage must be a video file");
        }
      }

      const consentResponse = await fetch(consentUrl, { method: "HEAD" });
      if (!consentResponse.ok) {
        errors.push(
          `Consent statement URL is not accessible: ${consentResponse.status}`
        );
      } else {
        // Validate content type
        const consentContentType = consentResponse.headers.get("content-type");
        if (!consentContentType?.includes("video/")) {
          errors.push("Consent statement must be a video file");
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join("; "));
      }

      return {
        trainingUrlValid: true,
        consentUrlValid: true,
        errors: [],
      };
    } catch (error: any) {
      console.error("Video URL validation failed:", error?.message || error);
      throw new Error(
        `Video URL validation failed: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Submit payload to Heygen API using env HEYGEN_BASE_URL and HEYGEN_API_KEY
   */
  private async submitToHeygen(
    payload: HeyGenSubmitPayload,
    userId?: string,
    authToken?: string
  ): Promise<HeyGenSubmitResponse> {
    // Validate configuration
    const configValidation = validateHeyGenConfig();
    if (!configValidation.valid) {
      throw new Error(configValidation.error || "HeyGen configuration missing");
    }

    // Validate payload
    const validationResult = heyGenSubmitPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new Error(
        `Invalid payload: ${validationResult.error.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    const baseUrl = process.env.HEYGEN_BASE_URL!;
    const apiKey = process.env.HEYGEN_API_KEY!;
    const url = `${baseUrl.replace(/\/$/, "")}${HEYGEN_VIDEO_AVATAR_ENDPOINT}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Heygen responded ${res.status}: ${text}`);
      }

      const data = (await res.json().catch(() => ({}))) as HeyGenSubmitResponse;

      // Validate response
      const responseValidation = heyGenResponseSchema.safeParse(data);
      if (!responseValidation.success) {
        console.warn(
          "Invalid HeyGen response format:",
          responseValidation.error.errors
        );
      }

      // Get user information using auth service if userId is not provided
      let finalUserId = userId;
      if (!finalUserId && authToken) {
        try {
          const authService = new (
            await import("../auth.service")
          ).default();
          const user = await authService.getCurrentUser(authToken);
          if (user) {
            finalUserId = user._id.toString();
          }
        } catch (error: any) {
          console.error(
            "Error getting user from auth token:",
            error?.message || error
          );
        }
      }

      if (data?.data?.avatar_id) {
        // Start polling in background - don't wait for completion
        this.startAvatarStatusPolling(
          data.data.avatar_id,
          authToken,
          finalUserId
        ).catch((error: any) => {
          console.error(
            "Error starting avatar status polling:",
            error?.message || error
          );
        });
      }

      return data;
    } catch (error: any) {
      console.error("Error submitting to HeyGen:", error?.message || error);
      throw error;
    }
  }

  /**
   * Start polling Heygen API every 10 seconds for avatar status
   */
  private async startAvatarStatusPolling(
    avatarId: string,
    authToken?: string,
    userId?: string
  ): Promise<HeyGenPollingResponse> {
    const configValidation = validateHeyGenConfig();
    if (!configValidation.valid) {
      console.error(`Cannot start polling: ${configValidation.error}`);
      return Promise.reject(new Error(configValidation.error));
    }

    const baseUrl = process.env.HEYGEN_BASE_URL!;
    const apiKey = process.env.HEYGEN_API_KEY!;
    const url = `${baseUrl.replace(
      /\/$/,
      ""
    )}${HEYGEN_VIDEO_AVATAR_ENDPOINT}/${avatarId}`;

    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          const heygenRes = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
          });

          if (!heygenRes.ok) {
            console.warn(
              `HeyGen API returned ${heygenRes.status} for avatar ${avatarId}`
            );
            return;
          }

          const heygenData = (await heygenRes
            .json()
            .catch(() => ({}))) as HeyGenPollingResponse;

          // Update local database with Heygen response
          if (heygenData && Object.keys(heygenData).length > 0) {
            if (userId) {
              notificationService.notifyVideoAvatarProgress(
                userId,
                avatarId,
                "ai_processing",
                "progress",
                formatNotificationPayload(
                  avatarId,
                  heygenData?.data?.avatar_name,
                  {
                    status: heygenData.data?.status,
                    message: `AI is processing your avatar... Status: ${
                      heygenData.data?.status || "processing"
                    }`,
                  }
                )
              );
            }

            // Stop polling if status is completed or failed
            const status = heygenData.data?.status;
            if (status === "completed" || status === "failed") {
              // Emit final socket notification
              if (userId) {
                const finalStatus =
                  status === "completed" ? "completed" : "error";
                notificationService.notifyVideoAvatarProgress(
                  userId,
                  avatarId,
                  "ai_processing_complete",
                  finalStatus,
                  formatNotificationPayload(
                    avatarId,
                    heygenData?.data?.avatar_name,
                    {
                      status,
                      preview_image_url: heygenData?.data?.preview_image_url,
                      preview_video_url: heygenData?.data?.preview_video_url,
                      default_voice_id: heygenData?.data?.default_voice_id,
                      message:
                        finalStatus === "completed"
                          ? "Avatar creation completed successfully!"
                          : "Avatar creation failed",
                    }
                  )
                );
              }

              // Only save DefaultAvatar if status is "completed" and preview_image_url is not empty
              if (status === "completed") {
                const previewImageUrl = heygenData?.data?.preview_image_url;
                const hasPreviewImageUrl =
                  previewImageUrl && String(previewImageUrl).trim().length > 0;

                if (!hasPreviewImageUrl) {
                  clearInterval(pollInterval);
                  resolve(heygenData);
                  return;
                }

                // Save DefaultAvatar only if preview_image_url exists
                const avatarData: DefaultAvatarData = {
                  avatar_id: avatarId,
                  avatar_name:
                    heygenData?.data?.avatar_name || "Unnamed Avatar",
                  default: true,
                  userId: userId,
                  status: DEFAULT_VIDEO_AVATAR_STATUS,
                  avatarType: DEFAULT_VIDEO_AVATAR_TYPE,
                  preview_image_url: previewImageUrl!.trim(),
                };

                // Only include preview_video_url if it's not empty
                if (
                  heygenData?.data?.preview_video_url &&
                  String(heygenData.data.preview_video_url).trim().length > 0
                ) {
                  avatarData.preview_video_url =
                    heygenData.data.preview_video_url.trim();
                }

                const defaultAvatar = new DefaultAvatar(avatarData);
                await defaultAvatar.save();

                // Successfully completed - clear intervals and resolve
                clearInterval(pollInterval);
                resolve(heygenData);
              } else {
                // Status is "failed" - stop socket and throw error (don't save)
                clearInterval(pollInterval);
                reject(
                  new Error(
                    `Avatar creation failed for ${avatarId}. Status: ${
                      status || "failed"
                    }`
                  )
                );
              }
            }
          }
        } catch (error: any) {
          console.error(
            `Error polling avatar status for ${avatarId}:`,
            error?.message || error
          );

          // Emit error socket notification
          if (userId) {
            notificationService.notifyVideoAvatarProgress(
              userId,
              avatarId,
              "polling_error",
              "error",
              formatNotificationPayload(avatarId, undefined, {
                error: error?.message || "Unknown error",
                message: "Error occurred while checking avatar status",
              })
            );
          }

          clearInterval(pollInterval);
          reject(error);
        }
      }, POLLING_INTERVAL_MS);
    });
  }

  /**
   * Send callback notification with user authentication
   */
  private async sendCallback(
    avatar: IVideoAvatar,
    userToken?: string
  ): Promise<void> {
    try {
      if (!avatar.callback_url) {
        return;
      }

      const webhookPayload: WebhookRequest = {
        avatar_id: avatar.avatar_id,
        status: avatar.status as "completed" | "failed",
        avatar_group_id: avatar.avatar_group_id,
        callback_id: avatar.callback_id,
      };

      // Use custom webhook service with user authentication
      const result = await this.webhookService.processWebhookWithAuth(
        avatar.callback_url,
        webhookPayload,
        userToken
      );

      if (!result.success) {
        console.error(
          `Webhook callback failed for avatar ${avatar.avatar_id}:`,
          result.message
        );
      }
    } catch (error: any) {
      console.error(
        `Error sending callback for avatar ${avatar.avatar_id}:`,
        error?.message || error
      );
    }
  }

  /**
   * Create a new video avatar request with file uploads
   */
  async createVideoAvatarWithFiles(
    request: CreateVideoAvatarWithFilesRequest,
    urls?: FileUploadUrls,
    userId?: string,
    authToken?: string
  ): Promise<CreateVideoAvatarResponse> {
    try {
      // Generate unique avatar ID
      const avatar_id = generateAvatarId();

      // Generate or use provided avatar group ID
      const avatar_group_id =
        request.avatar_group_id || generateAvatarGroupId();

      // Emit socket notification for avatar ID generation
      if (userId) {
        notificationService.notifyVideoAvatarProgress(
          userId,
          avatar_id,
          "avatar_created",
          "progress",
          formatNotificationPayload(avatar_id, request.avatar_name, {
            avatar_group_id,
            message: "Avatar ID generated, starting file processing...",
          })
        );
      }

      const avatarUrls: AvatarUrls = {
        trainingFootageUrl: urls?.training_footage_url,
        consentStatementUrl: urls?.consent_statement_url,
        trainingFootageSignedUrl: urls?.training_footage_url,
        consentStatementSignedUrl: urls?.consent_statement_url,
      };

      // Upload files to S3 if provided
      if (request.training_footage_file) {
        // Emit socket notification for file upload start
        if (userId) {
          notificationService.notifyVideoAvatarProgress(
            userId,
            avatar_id,
            "file_upload",
            "progress",
            formatNotificationPayload(avatar_id, request.avatar_name, {
              message: "Uploading training footage to cloud storage...",
            })
          );
        }

        const result = await this.uploadFileToS3WithSignedUrl(
          request.training_footage_file,
          avatar_id,
          "training_footage"
        );
        avatarUrls.trainingFootageUrl = this.s3Service.getVideoUrl(
          result.s3Key
        );
        avatarUrls.trainingFootageSignedUrl = result.signedUrl;
      }

      if (request.consent_statement_file) {
        // Emit socket notification for consent file upload
        if (userId) {
          notificationService.notifyVideoAvatarProgress(
            userId,
            avatar_id,
            "file_upload",
            "progress",
            formatNotificationPayload(avatar_id, request.avatar_name, {
              message: "Uploading consent statement to cloud storage...",
            })
          );
        }

        const result = await this.uploadFileToS3WithSignedUrl(
          request.consent_statement_file,
          avatar_id,
          "consent_statement"
        );
        avatarUrls.consentStatementUrl = this.s3Service.getVideoUrl(
          result.s3Key
        );
        avatarUrls.consentStatementSignedUrl = result.signedUrl;
      }

      // Handle existing S3 URLs - generate signed URLs for external access
      if (urls?.training_footage_url && !request.training_footage_file) {
        const signedUrl = await this.generateSignedUrlForS3File(
          avatarUrls.trainingFootageUrl!
        );
        if (signedUrl) {
          avatarUrls.trainingFootageSignedUrl = signedUrl;
        }
      }

      if (urls?.consent_statement_url && !request.consent_statement_file) {
        const signedUrl = await this.generateSignedUrlForS3File(
          avatarUrls.consentStatementUrl!
        );
        if (signedUrl) {
          avatarUrls.consentStatementSignedUrl = signedUrl;
        }
      }

      // Validate URLs are accessible (skip if they are S3 URLs we just uploaded)
      if (avatarUrls.trainingFootageUrl && avatarUrls.consentStatementUrl) {
        if (
          !isS3Url(avatarUrls.trainingFootageUrl) &&
          !isS3Url(avatarUrls.consentStatementUrl)
        ) {
          await this.validateVideoUrls(
            avatarUrls.trainingFootageUrl,
            avatarUrls.consentStatementUrl
          );
        }
      }

      // Emit socket notification for Heygen submission start
      if (userId) {
        notificationService.notifyVideoAvatarProgress(
          userId,
          avatar_id,
          "heygen_submission",
          "progress",
          formatNotificationPayload(avatar_id, request.avatar_name, {
            message: "Submitting avatar to AI processing service...",
          })
        );
      }

      // Wait for Heygen response and return it
      const heygenResponse = await this.submitToHeygen(
        {
          training_footage_url: avatarUrls.trainingFootageSignedUrl!,
          video_consent_url: avatarUrls.consentStatementSignedUrl!,
          avatar_name: request.avatar_name,
          callback_id: request.callback_id,
          callback_url: request.callback_url,
        },
        userId,
        authToken
      );

      // Transform HeyGen response to CreateVideoAvatarResponse
      const response: CreateVideoAvatarResponse = {
        avatar_id: heygenResponse?.data?.avatar_id || avatar_id,
        avatar_group_id,
        status: heygenResponse?.data?.status,
        message:
          heygenResponse?.data?.status === "processing"
            ? "Avatar processing started"
            : undefined,
        preview_image_url: heygenResponse?.data?.preview_image_url,
        preview_video_url: heygenResponse?.data?.preview_video_url,
        default_voice_id: heygenResponse?.data?.default_voice_id,
        avatar_name: heygenResponse?.data?.avatar_name || request.avatar_name,
        error:
          heygenResponse?.data?.status === "failed"
            ? "Avatar creation failed"
            : undefined,
      };

      return response;
    } catch (error: any) {
      console.error("Error creating video avatar:", error?.message || error);
      throw new Error(
        `Failed to create video avatar: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Get avatar status by ID
   */
  async getAvatarStatus(avatar_id: string): Promise<VideoAvatarStatusResponse> {
    try {
      const avatar = await VideoAvatar.findOne({ avatar_id });

      if (!avatar) {
        throw new Error("Avatar ID not found");
      }

      const response: VideoAvatarStatusResponse = {
        avatar_id: avatar.avatar_id,
        status: avatar.status,
        avatar_group_id: avatar.avatar_group_id,
      };

      if (avatar.status === "failed" && avatar.error) {
        response.error = avatar.error;
      }

      // Add other avatar details if needed
      if (avatar.status === "completed") {
        response.avatar_name = avatar.avatar_name;
        response.completedAt = avatar.completedAt;
      }

      return response;
    } catch (error: any) {
      console.error("Error getting avatar status:", error?.message || error);
      throw new Error(
        `Failed to get avatar status: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Update avatar status
   */
  async updateAvatarStatus(
    avatar_id: string,
    status: UpdateAvatarStatus,
    error?: string
  ): Promise<void> {
    try {
      // Validate status
      if (!isValidUpdateAvatarStatus(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const updateData: any = { status };

      if (status === "completed") {
        updateData.completedAt = new Date();
      }

      if (status === "failed" && error) {
        updateData.error = error;
      }

      await VideoAvatar.findOneAndUpdate({ avatar_id }, updateData, {
        new: true,
      });

      // Send callback if configured
      const avatar = await VideoAvatar.findOne({ avatar_id });
      if (
        avatar?.callback_url &&
        (status === "completed" || status === "failed")
      ) {
        await this.sendCallback(avatar);
      }
    } catch (error: any) {
      console.error("Error updating avatar status:", error?.message || error);
      throw new Error(
        `Failed to update avatar status: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Get all avatars by group ID
   */
  async getAvatarsByGroup(avatar_group_id: string): Promise<VideoAvatarData[]> {
    try {
      const avatars = await VideoAvatar.find({ avatar_group_id }).sort({
        createdAt: -1,
      });

      return avatars.map((avatar) => ({
        avatar_id: avatar.avatar_id,
        avatar_group_id: avatar.avatar_group_id,
        avatar_name: avatar.avatar_name,
        training_footage_url: avatar.training_footage_url,
        consent_statement_url: avatar.consent_statement_url,
        status: avatar.status,
        callback_id: avatar.callback_id,
        callback_url: avatar.callback_url,
        error: avatar.error,
        createdAt: avatar.createdAt,
        updatedAt: avatar.updatedAt,
        completedAt: avatar.completedAt,
      }));
    } catch (error: any) {
      console.error("Error getting avatars by group:", error?.message || error);
      throw new Error(
        `Failed to get avatars by group: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Delete avatar
   */
  async deleteAvatar(avatar_id: string): Promise<boolean> {
    try {
      const result = await VideoAvatar.findOneAndDelete({ avatar_id });
      return !!result;
    } catch (error: any) {
      console.error("Error deleting avatar:", error?.message || error);
      throw new Error(
        `Failed to delete avatar: ${error?.message || "Unknown error"}`
      );
    }
  }
}

export default VideoAvatarService;
