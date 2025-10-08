import crypto from 'crypto';
import User from '../models/User';
import AuthService from './auth.service';
import VideoService from './video.service';
import {
  WebhookRequest,
  WebhookResponse,
  VideoAvatarCallbackPayload
} from '../types';

export class WebhookService {
  private authService = new AuthService();
  private videoService = new VideoService();

  /**
   * Validate user token and get user information
   */
  async validateUserToken(token: string): Promise<any> {
    try {
      if (!token) {
        throw new Error('Token is required');
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      
      // Verify the JWT token
      const payload = this.authService.verifyToken(cleanToken);
      
      if (!payload || !payload.userId) {
        throw new Error('Invalid token: missing user information');
      }

      // Get user from database
      const user = await User.findById(payload.userId).select('-password');
      
      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };
    } catch (error: any) {
      console.error('Error validating user token:', error);
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Send webhook notification with user information
   */
  async sendWebhookNotification(
    webhookUrl: string,
    payload: WebhookRequest,
    user?: any
  ): Promise<WebhookResponse> {
    try {
      const webhookPayload: VideoAvatarCallbackPayload = {
        avatar_id: payload.avatar_id,
        status: payload.status,
        avatar_group_id: payload.avatar_group_id,
        callback_id: payload.callback_id,
        user_id: payload.user_id
      };

      // Add user information if available
      if (user) {
        webhookPayload.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        };
      }

      console.log(`Sending webhook to ${webhookUrl}:`, webhookPayload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VideoAvatar-Webhook/1.0',
          'X-Webhook-Signature': this.generateWebhookSignature(webhookPayload)
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json().catch(() => ({}));

      return {
        success: true,
        message: 'Webhook sent successfully',
        data: responseData
      };
    } catch (error: any) {
      console.error('Error sending webhook:', error);
      return {
        success: false,
        message: `Webhook failed: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Generate webhook signature for security
   */
  private generateWebhookSignature(payload: any): string {
    const secret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      const expectedSignature = this.generateWebhookSignature(payload);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Process webhook with user authentication
   */
  async processWebhookWithAuth(
    webhookUrl: string,
    payload: WebhookRequest,
    userToken?: string
  ): Promise<WebhookResponse> {
    try {
      let user = null;
      
      // Validate user token if provided
      if (userToken) {
        user = await this.validateUserToken(userToken);
        payload.user_id = user.id;
      }

      // Send webhook notification
      return await this.sendWebhookNotification(webhookUrl, payload, user);
    } catch (error: any) {
      console.error('Error processing webhook with auth:', error);
      return {
        success: false,
        message: `Webhook processing failed: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(webhookUrl: string, userToken?: string): Promise<WebhookResponse> {
    try {
      const testPayload: WebhookRequest = {
        avatar_id: 'test_avatar_123',
        status: 'completed',
        avatar_group_id: 'test_group_456',
        callback_id: 'test_callback_789'
      };

      return await this.processWebhookWithAuth(webhookUrl, testPayload, userToken);
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      return {
        success: false,
        message: `Webhook test failed: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Handle video completion webhook (legacy method for v1 compatibility)
   */
  async handleVideoComplete(data: any): Promise<any> {
    try {
      const { videoId, status = 'ready', s3Key, metadata, error } = data;
      
      if (!videoId) {
        throw new Error('Video ID is required');
      }

      // If there's an error, mark video as failed
      const finalStatus = error ? 'failed' : status;

      // Update video status
      const updatedVideo = await this.videoService.updateVideoStatus(videoId, finalStatus);
      if (!updatedVideo) {
        throw new Error('Video not found');
      }

      // Update metadata if provided
      if (metadata) {
        await this.videoService.updateVideoMetadata(videoId, metadata);
      }

      // Update S3 key if provided (log for now)
      if (s3Key && s3Key !== updatedVideo.s3Key) {
        console.log(`Video complete webhook: S3 key updated for video ${videoId}`);
      }

      console.log(`Video complete webhook: Successfully updated video ${videoId} to status ${finalStatus}`);

      return {
        success: true,
        message: 'Video status updated successfully',
        data: {
          videoId: updatedVideo.videoId,
          status: updatedVideo.status,
          updatedAt: updatedVideo.updatedAt
        }
      };
    } catch (error: any) {
      console.error('Error handling video complete webhook:', error);
      throw error;
    }
  }
}

export default WebhookService;