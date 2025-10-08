import crypto from 'crypto';
import VideoAvatar, { IVideoAvatar } from '../models/VideoAvatar';
import { getS3 } from './s3';
import WebhookService from './webhook.service';
import {
  CreateVideoAvatarRequest,
  CreateVideoAvatarWithFilesRequest,
  CreateVideoAvatarResponse,
  VideoAvatarStatusResponse,
  VideoAvatarCallbackPayload,
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
    urls?: { training_footage_url?: string; consent_statement_url?: string }
  ): Promise<CreateVideoAvatarResponse> {
    try {
      // Generate unique avatar ID
      const avatar_id = `avatar_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      // Generate or use provided avatar group ID
      const avatar_group_id = request.avatar_group_id || 
        `group_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      let trainingFootageUrl = urls?.training_footage_url;
      let consentStatementUrl = urls?.consent_statement_url;

      // Upload files to S3 if provided
      if (request.training_footage_file) {
        trainingFootageUrl = await this.uploadFileToS3(
          request.training_footage_file,
          avatar_id,
          'training_footage'
        );
      }

      if (request.consent_statement_file) {
        consentStatementUrl = await this.uploadFileToS3(
          request.consent_statement_file,
          avatar_id,
          'consent_statement'
        );
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

      // Create video avatar record
      const videoAvatar = new VideoAvatar({
        avatar_id,
        avatar_group_id,
        avatar_name: request.avatar_name,
        training_footage_url: trainingFootageUrl!,
        consent_statement_url: consentStatementUrl!,
        status: 'in_progress',
        callback_id: request.callback_id,
        callback_url: request.callback_url
      });

      await videoAvatar.save();

      // Submit to Heygen if env is configured
      try {
        await this.submitToHeygen({
          training_footage_url: trainingFootageUrl!,
          consent_statement_url: consentStatementUrl!,
          avatar_name: request.avatar_name,
          avatar_group_id,
          callback_id: request.callback_id,
          callback_url: request.callback_url,
        })
      } catch (e: any) {
        console.error('Heygen submission failed (non-blocking):', e?.message || e)
      }

      // Start avatar generation process asynchronously
      this.processAvatarGeneration(avatar_id).catch(error => {
        console.error(`Avatar generation failed for ${avatar_id}:`, error);
        this.updateAvatarStatus(avatar_id, 'failed', error.message);
      });

      return {
        avatar_id,
        avatar_group_id
      };
    } catch (error: any) {
      console.error('Error creating video avatar:', error);
      throw new Error(`Failed to create video avatar: ${error.message}`);
    }
  }

  /**
   * Create a new video avatar request (legacy method for URL-based requests)
   */
  async createVideoAvatar(request: CreateVideoAvatarRequest): Promise<CreateVideoAvatarResponse> {
    try {
      // Generate unique avatar ID
      const avatar_id = `avatar_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      // Generate or use provided avatar group ID
      const avatar_group_id = request.avatar_group_id || 
        `group_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      // Validate URLs are accessible
      if (request.training_footage_url && request.consent_statement_url) {
        await this.validateVideoUrls(request.training_footage_url, request.consent_statement_url);
      }

      // Create video avatar record
      const videoAvatar = new VideoAvatar({
        avatar_id,
        avatar_group_id,
        avatar_name: request.avatar_name,
        training_footage_url: request.training_footage_url!,
        consent_statement_url: request.consent_statement_url!,
        status: 'in_progress',
        callback_id: request.callback_id,
        callback_url: request.callback_url
      });

      await videoAvatar.save();

      // Submit to Heygen if env is configured
      try {
        await this.submitToHeygen({
          training_footage_url: request.training_footage_url!,
          consent_statement_url: request.consent_statement_url!,
          avatar_name: request.avatar_name,
          avatar_group_id,
          callback_id: request.callback_id,
          callback_url: request.callback_url,
        })
      } catch (e: any) {
        console.error('Heygen submission failed (non-blocking):', e?.message || e)
      }

      // Start avatar generation process asynchronously
      this.processAvatarGeneration(avatar_id).catch(error => {
        console.error(`Avatar generation failed for ${avatar_id}:`, error);
        this.updateAvatarStatus(avatar_id, 'failed', error.message);
      });

      return {
        avatar_id,
        avatar_group_id
      };
    } catch (error: any) {
      console.error('Error creating video avatar:', error);
      throw new Error(`Failed to create video avatar: ${error.message}`);
    }
  }

  /**
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
   * Upload file to S3 and return the URL
   */
  private async uploadFileToS3(
    file: Express.Multer.File,
    avatarId: string,
    fileType: 'training_footage' | 'consent_statement'
  ): Promise<string> {
    try {
      // Generate S3 key for the file
      const timestamp = Date.now();
      const filename = file.originalname || `${fileType}.mp4`;
      const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const s3Key = `video_avatars/${avatarId}/${fileType}/${timestamp}_${safeFilename}`;

      // Upload file to S3
      await this.s3Service.uploadVideoDirectly(
        s3Key,
        file.buffer,
        file.mimetype,
        {
          avatarId,
          fileType,
          uploadedAt: new Date().toISOString(),
          originalName: file.originalname
        }
      );

      // Return the S3 URL
      return this.s3Service.getVideoUrl(s3Key);
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
    consent_statement_url: string
    avatar_name: string
    avatar_group_id?: string
    callback_id?: string
    callback_url?: string
  }): Promise<void> {
    const baseUrl = process.env.HEYGEN_BASE_URL
    const apiKey = process.env.HEYGEN_API_KEY
    if (!baseUrl || !apiKey) {
      console.log('HEYGEN_BASE_URL/HEYGEN_API_KEY not set; skipping Heygen submission')
      return
    }
    const url = `${baseUrl.replace(/\/$/, '')}/v2/video_avatar`

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

    const data = await res.json().catch(() => ({}))
    console.log('Heygen submission ok:', data)
  }

  /**
   * Process avatar generation (simulated)
   */
  private async processAvatarGeneration(avatar_id: string): Promise<void> {
    try {
      console.log(`Starting avatar generation for ${avatar_id}`);
      
      // Simulate processing time (in real implementation, this would call external service)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Simulate success (in real implementation, this would be based on actual processing result)
      const success = Math.random() > 0.1; // 90% success rate for simulation
      
      if (success) {
        await this.updateAvatarStatus(avatar_id, 'completed');
        console.log(`Avatar generation completed for ${avatar_id}`);
      } else {
        await this.updateAvatarStatus(avatar_id, 'failed', 'Avatar generation failed due to processing error');
        console.log(`Avatar generation failed for ${avatar_id}`);
      }
    } catch (error: any) {
      console.error(`Avatar generation error for ${avatar_id}:`, error);
      await this.updateAvatarStatus(avatar_id, 'failed', error.message);
    }
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
