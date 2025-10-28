import crypto from 'crypto';
import VideoAvatar, { IVideoAvatar } from '../models/VideoAvatar';
import DefaultAvatar from '../models/avatar';
import { getS3 } from './s3';
import WebhookService from './webhook.service';
import { notificationService } from './notification.service';
import {
  CreateVideoAvatarWithFilesRequest,
  CreateVideoAvatarResponse,
  VideoAvatarStatusResponse,
  VideoAvatarData,
  WebhookRequest
} from '../types';

export class VideoAvatarService {
  private s3Service = getS3();
  private webhookService = new WebhookService();

  /**
   * Create a new video avatar request with file uploads
   */
  async createVideoAvatarWithFiles(
    request: CreateVideoAvatarWithFilesRequest,
    urls?: { training_footage_url?: string; consent_statement_url?: string },
    userId?: string,
    authToken?: string
  ): Promise<CreateVideoAvatarResponse> {
    try {
      // Generate unique avatar ID
      const avatar_id = `avatar_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      // Generate or use provided avatar group ID
      const avatar_group_id = request.avatar_group_id || 
        `group_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      // Emit socket notification for avatar ID generation
      if (userId) {
        notificationService.notifyVideoAvatarProgress(
          userId,
          avatar_id,
          "avatar_created",
          "progress",
          {
            avatar_id,
            avatar_group_id,
            avatar_name: request.avatar_name,
            message: "Avatar ID generated, starting file processing..."
          }
        );
      }

      let trainingFootageUrl = urls?.training_footage_url;
      let consentStatementUrl = urls?.consent_statement_url;
      let trainingFootageSignedUrl = trainingFootageUrl;
      let consentStatementSignedUrl = consentStatementUrl;

      // Upload files to S3 if provided
      if (request.training_footage_file) {
        // Emit socket notification for file upload start
        if (userId) {
          notificationService.notifyVideoAvatarProgress(
            userId,
            avatar_id,
            "file_upload",
            "progress",
            {
              avatar_id,
              avatar_name: request.avatar_name,
              message: "Uploading training footage to cloud storage..."
            }
          );
        }

        const result = await this.uploadFileToS3WithSignedUrl(
          request.training_footage_file,
          avatar_id,
          'training_footage'
        );
        trainingFootageUrl = this.s3Service.getVideoUrl(result.s3Key);
        trainingFootageSignedUrl = result.signedUrl;
      }

      if (request.consent_statement_file) {
        // Emit socket notification for consent file upload
        if (userId) {
          notificationService.notifyVideoAvatarProgress(
            userId,
            avatar_id,
            "file_upload",
            "progress",
            {
              avatar_id,
              avatar_name: request.avatar_name,
              message: "Uploading consent statement to cloud storage..."
            }
          );
        }

        const result = await this.uploadFileToS3WithSignedUrl(
          request.consent_statement_file,
          avatar_id,
          'consent_statement'
        );
        consentStatementUrl = this.s3Service.getVideoUrl(result.s3Key);
        consentStatementSignedUrl = result.signedUrl;
      }

      // Handle existing S3 URLs - generate signed URLs for external access
      if (urls?.training_footage_url && !request.training_footage_file) {
        const isS3Url = (u: string) =>
          /\.amazonaws\.com\//.test(u) ||
          (process.env.AWS_S3_BUCKET ? u.includes(process.env.AWS_S3_BUCKET) : false);

        if (isS3Url(trainingFootageUrl!)) {
          // Extract S3 key from URL and generate view URL
          const s3Key = this.extractS3KeyFromUrl(trainingFootageUrl!);
          if (s3Key) {
            trainingFootageSignedUrl = await this.s3Service.createVideoAvatarViewUrl(s3Key, 86400);
          }
        } else {
          trainingFootageSignedUrl = trainingFootageUrl;
        }
      }

      if (urls?.consent_statement_url && !request.consent_statement_file) {
        const isS3Url = (u: string) =>
          /\.amazonaws\.com\//.test(u) ||
          (process.env.AWS_S3_BUCKET ? u.includes(process.env.AWS_S3_BUCKET) : false);

        if (isS3Url(consentStatementUrl!)) {
          // Extract S3 key from URL and generate view URL
          const s3Key = this.extractS3KeyFromUrl(consentStatementUrl!);
          if (s3Key) {
            consentStatementSignedUrl = await this.s3Service.createVideoAvatarViewUrl(s3Key, 86400);
          }
        } else {
          consentStatementSignedUrl = consentStatementUrl;
        }
      }

      // Validate URLs are accessible (skip if they are S3 URLs we just uploaded)
      if (trainingFootageUrl && consentStatementUrl) {
        const isS3Url = (u: string) =>
          /\.amazonaws\.com\//.test(u) ||
          (process.env.AWS_S3_BUCKET ? u.includes(process.env.AWS_S3_BUCKET) : false);

        if (!isS3Url(trainingFootageUrl) && !isS3Url(consentStatementUrl)) {
          await this.validateVideoUrls(trainingFootageUrl, consentStatementUrl);
        } else {
          console.log('Skipping URL HEAD validation for S3 URLs')
        }
      }


      // Submit to Heygen if env is configured and wait for completion
      console.log(`🚀 Starting Heygen submission for avatar ${avatar_id}...`);

      // Emit socket notification for Heygen submission start
      if (userId) {
        notificationService.notifyVideoAvatarProgress(
          userId,
          avatar_id,
          "heygen_submission",
          "progress",
          {
            avatar_id,
            avatar_name: request.avatar_name,
            message: "Submitting avatar to AI processing service..."
          }
        );
      }


      // Return immediately with processing status - socket will handle real-time updates
      console.log(`✅ Returning processing status for avatar ${avatar_id} - socket will provide updates`);
      
      // Wait for Heygen response and return it
      const heygenResponse = await this.submitToHeygen({
        training_footage_url: trainingFootageSignedUrl!,
        video_consent_url: consentStatementSignedUrl!,
        avatar_name: request.avatar_name,
        callback_id: request.callback_id,
        callback_url: request.callback_url,
      }, userId, authToken);
      
      return heygenResponse;
    } catch (error: any) {
      console.error('Error creating video avatar:', error);
      throw new Error(`Failed to create video avatar: ${error.message}`);
    }
  }

  /**
   * Create a new video avatar request (legacy method for URL-based requests)
   * Get avatar status by ID
   */
  async getAvatarStatus(avatar_id: string): Promise<VideoAvatarStatusResponse> {
    try {
      const avatar = await VideoAvatar.findOne({ avatar_id });
      
      if (!avatar) {
        throw new Error('Avatar ID not found');
      }

      const response: VideoAvatarStatusResponse = {
        avatar_id: avatar.avatar_id,
        status: avatar.status,
        avatar_group_id: avatar.avatar_group_id
      };

      if (avatar.status === 'failed' && avatar.error) {
        response.error = avatar.error;
      }

      // Add other avatar details if needed
      if (avatar.status === 'completed') {
        response.avatar_name = avatar.avatar_name;
        response.completedAt = avatar.completedAt;
      }

      return response;
    } catch (error: any) {
      console.error('Error getting avatar status:', error);
      throw new Error(`Failed to get avatar status: ${error.message}`);
    }
  }

  /**
   * Update avatar status
   */
  async updateAvatarStatus(avatar_id: string, status: 'in_progress' | 'completed' | 'failed', error?: string): Promise<void> {
    try {
      const updateData: any = { status };
      
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }
      
      if (status === 'failed' && error) {
        updateData.error = error;
      }

      await VideoAvatar.findOneAndUpdate(
        { avatar_id },
        updateData,
        { new: true }
      );

      // Send callback if configured
      const avatar = await VideoAvatar.findOne({ avatar_id });
      if (avatar?.callback_url && (status === 'completed' || status === 'failed')) {
        await this.sendCallback(avatar);
      }
    } catch (error: any) {
      console.error('Error updating avatar status:', error);
      throw new Error(`Failed to update avatar status: ${error.message}`);
    }
  }

  /**
   * Upload file to S3 and return both S3 key and signed URL for external access
   */
  private async uploadFileToS3WithSignedUrl(
    file: Express.Multer.File,
    avatarId: string,
    fileType: 'training_footage' | 'consent_statement'
  ): Promise<{ s3Key: string; signedUrl: string }> {
    try {
      // Generate S3 key for the file
      const timestamp = Date.now();
      const filename = file.originalname || `${fileType}.mp4`;
      const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `video_avatars/${avatarId}/${fileType}/${timestamp}_${safeFilename}`;

      // Upload file to S3 using file path (streaming for large files)
      await this.s3Service.uploadVideoFromPath(
        s3Key,
        file.path, // Use file.path for disk storage
        file.mimetype,
        {
          avatarId,
          fileType,
          uploadedAt: new Date().toISOString(),
          originalName: file.originalname
        }
      );

      // Generate view URL for external access (valid for 24 hours)
      const viewUrl = await this.s3Service.createVideoAvatarViewUrl(s3Key, 86400);

      return { s3Key, signedUrl: viewUrl };
    } catch (error: any) {
      console.error(`Error uploading ${fileType} to S3:`, error);
      throw new Error(`Failed to upload ${fileType} to S3: ${error.message}`);
    }
  }

  /**
   * Validate video URLs are accessible
   */
  private async validateVideoUrls(trainingUrl: string, consentUrl: string): Promise<void> {
    try {
      // Check if URLs are valid
      const trainingResponse = await fetch(trainingUrl, { method: 'HEAD' });
      if (!trainingResponse.ok) {
        throw new Error(`Training footage URL is not accessible: ${trainingResponse.status}`);
      }

      const consentResponse = await fetch(consentUrl, { method: 'HEAD' });
      if (!consentResponse.ok) {
        throw new Error(`Consent statement URL is not accessible: ${consentResponse.status}`);
      }

      // Validate content type
      const trainingContentType = trainingResponse.headers.get('content-type');
      const consentContentType = consentResponse.headers.get('content-type');
      
      if (!trainingContentType?.includes('video/')) {
        throw new Error('Training footage must be a video file');
      }
      
      if (!consentContentType?.includes('video/')) {
        throw new Error('Consent statement must be a video file');
      }
    } catch (error: any) {
      console.error('Error validating video URLs:', error);
      throw new Error(`Video URL validation failed: ${error.message}`);
    }
  }

  /**
   * Submit payload to Heygen API using env HEYGEN_BASE_URL and HEYGEN_API_KEY
   */
  private async submitToHeygen(payload: {
    training_footage_url: string
    video_consent_url: string
    avatar_name: string
    callback_id?: string
    callback_url?: string
  }, userId?: string, authToken?: string): Promise<any> {
    const baseUrl = process.env.HEYGEN_BASE_URL
    const apiKey = process.env.HEYGEN_API_KEY
    if (!baseUrl || !apiKey) {
      console.log('HEYGEN_BASE_URL/HEYGEN_API_KEY not set; skipping Heygen submission')
      return
    }
    const url = `${baseUrl.replace(/\/$/, '')}/video_avatar`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Heygen responded ${res.status}: ${text}`)
    }

    const data = await res.json().catch(() => ({})) as any
    console.log('Heygen response data:', JSON.stringify(data, null, 2));

    // Get user information using auth service if userId is not provided
    let finalUserId = userId;
    if (!finalUserId && authToken) {
      try {
        const authService = new (await import("../modules/auth/services/auth.service")).default();
        const user = await authService.getCurrentUser(authToken);
        if (user) {
          finalUserId = user._id.toString();
          console.log('Got userId from auth service:', finalUserId);
        }
      } catch (error: any) {
        console.error('Error getting user from auth service:', error);
      }
    }


    if (data?.data?.avatar_id) {
      console.log(`Starting polling for avatar ${data.data.avatar_id} as status is processing`);
      // Start polling in background - don't wait for completion
      this.startAvatarStatusPolling(data.data.avatar_id, authToken, finalUserId).catch(error => {
        console.error(`Error in background polling for ${data.data.avatar_id}:`, error);
      });
    }
    
    // Return the initial Heygen response immediately
    console.log('Returning initial Heygen response:', data);
    return data;
  }

  /**
   * Start polling Heygen API every 10 seconds for avatar status
   */
  private async startAvatarStatusPolling(avatarId: string, authToken?: string, userId?: string): Promise<any> {
    const baseUrl = process.env.HEYGEN_BASE_URL;
    const apiKey = process.env.HEYGEN_API_KEY;
    
    if (!baseUrl || !apiKey) {
      console.log('HEYGEN_BASE_URL/HEYGEN_API_KEY not set; skipping polling');
      return null;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/video_avatar/${avatarId}`;
    console.log(`Starting polling for avatar ${avatarId}:`, url);

    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          console.log(`Polling Heygen API for avatar ${avatarId}...`);
          
          const heygenRes = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
          });

          if (!heygenRes.ok) {
            console.error(`Heygen API polling error for ${avatarId}: ${heygenRes.status}`);
            return;
          }

          const heygenData = await heygenRes.json().catch(() => ({})) as any;
          console.log(`Heygen polling response for ${avatarId}:`, heygenData);

          // Update local database with Heygen response
          if (heygenData && Object.keys(heygenData).length > 0) {
            // await this.updateAvatarFromHeygenResponse(avatarId, heygenData, userId);
            if (userId) {
              notificationService.notifyVideoAvatarProgress(
                userId,
                avatarId,
                "ai_processing",
                "progress",
                {
                  avatar_id: avatarId,
                  avatar_name: heygenData?.data?.avatar_name,
                  status: heygenData.data?.status,
                  message: `AI is processing your avatar... Status: ${heygenData.data?.status || 'processing'}`
                }
              );
            }

            // Stop polling if status is completed or failed
            if (heygenData.data.status === 'completed' || heygenData.data.status === 'failed') {
              console.log(`✅ Avatar ${avatarId} status is ${heygenData.status}, stopping polling`);
              console.log(`Final response saved for avatar ${avatarId}:`, heygenData);

              // Emit final socket notification
              if (userId) {
                const finalStatus = heygenData.data.status === 'completed' ? 'completed' : 'error';
                notificationService.notifyVideoAvatarProgress(
                  userId,
                  avatarId,
                  "ai_processing_complete",
                  finalStatus,
                  {
                    avatar_id: avatarId,
                    avatar_name: heygenData?.data?.avatar_name,
                    status: heygenData.data?.status,
                    preview_image_url: heygenData?.data?.preview_image_url,
                    preview_video_url: heygenData?.data?.preview_video_url,
                    default_voice_id: heygenData?.data?.default_voice_id,
                    message: finalStatus === 'completed'
                      ? "Avatar creation completed successfully!"
                      : "Avatar creation failed"
                  }
                );
              }

              const defaultAvatar = new DefaultAvatar({
                avatar_id: avatarId,
                avatar_name: heygenData?.data?.avatar_name,
                default: true,
                preview_image_url: heygenData?.data?.preview_image_url,
                preview_video_url: heygenData?.data?.preview_video_url,
                userId: userId,
                status: 'training'
              });
              await defaultAvatar.save();
              clearInterval(pollInterval);
              resolve(heygenData); // Resolve with final response
            } else {
              console.log(`⏳ Avatar ${avatarId} status is ${heygenData.status}, continuing polling...`);
            }
          } else {
            console.log(`⚠️ No valid response data for avatar ${avatarId}, continuing polling...`);
          }
        } catch (error: any) {
          console.error(`Error polling Heygen API for avatar ${avatarId}:`, error);

          // Emit error socket notification
          if (userId) {
            notificationService.notifyVideoAvatarProgress(
              userId,
              avatarId,
              "polling_error",
              "error",
              {
                avatar_id: avatarId,
                error: error.message,
                message: "Error occurred while checking avatar status"
              }
            );
          }

          clearInterval(pollInterval);
          reject(error);
        }
      }, 10000); // Poll every 10 seconds

      // Stop polling after 5 minutes to prevent infinite polling
      setTimeout(() => {
        console.log(`Stopping polling for avatar ${avatarId} after 5 minutes`);

        // Emit timeout socket notification
        if (userId) {
          notificationService.notifyVideoAvatarProgress(
            userId,
            avatarId,
            "timeout",
            "error",
            {
              avatar_id: avatarId,
              error: "Avatar creation timed out after 5 minutes",
              message: "Avatar creation timed out. Please try again."
            }
          );
        }

        clearInterval(pollInterval);
        reject(new Error(`Polling timeout for avatar ${avatarId} after 5 minutes`));
      }, 10 * 60 * 1000); // 5 minutes timeout
    });
  }

  /**
   * Send callback notification with user authentication
   */
  private async sendCallback(avatar: IVideoAvatar, userToken?: string): Promise<void> {
    try {
      if (!avatar.callback_url) return;

      const webhookPayload: WebhookRequest = {
        avatar_id: avatar.avatar_id,
        status: avatar.status as 'completed' | 'failed',
        avatar_group_id: avatar.avatar_group_id,
        callback_id: avatar.callback_id
      };

      // Use custom webhook service with user authentication
      const result = await this.webhookService.processWebhookWithAuth(
        avatar.callback_url,
        webhookPayload,
        userToken
      );

      if (result.success) {
        console.log(`Callback sent successfully for avatar ${avatar.avatar_id}`);
      } else {
        console.error(`Callback failed for avatar ${avatar.avatar_id}:`, result.message);
      }
    } catch (error: any) {
      console.error(`Error sending callback for avatar ${avatar.avatar_id}:`, error);
    }
  }

  /**
   * Extract S3 key from S3 URL
   */
  private extractS3KeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Remove leading slash and return the key
      return pathname.startsWith('/') ? pathname.slice(1) : pathname;
    } catch (error) {
      console.error('Error extracting S3 key from URL:', error);
      return null;
    }
  }

  /**
   * Get all avatars by group ID
   */
  async getAvatarsByGroup(avatar_group_id: string): Promise<VideoAvatarData[]> {
    try {
      const avatars = await VideoAvatar.find({ avatar_group_id }).sort({ createdAt: -1 });
      return avatars.map(avatar => ({
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
        completedAt: avatar.completedAt
      }));
    } catch (error: any) {
      console.error('Error getting avatars by group:', error);
      throw new Error(`Failed to get avatars by group: ${error.message}`);
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
      console.error('Error deleting avatar:', error);
      throw new Error(`Failed to delete avatar: ${error.message}`);
    }
  }
}

export default VideoAvatarService;
