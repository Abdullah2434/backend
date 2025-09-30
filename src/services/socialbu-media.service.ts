import axios, { AxiosError } from 'axios';
import SocialBuMedia, { ISocialBuMedia } from '../models/SocialBuMedia';
import { connectMongo } from '../config/mongoose';
import socialBuService from './socialbu.service';

interface SocialBuUploadMediaRequest {
  name: string;
  mime_type: string;
  videoUrl?: string; // Optional video URL for the upload script
}

interface SocialBuUploadMediaResponse {
  name: string;
  mime_type: string;
  signed_url: string;
  key: string;
  secure_key: string;
  url: string;
}

interface UploadScriptResponse {
  statusCode: number;
  headers: any;
  success: boolean;
  finalVideoUrl?: string;
  errorMessage?: string;
}

interface MediaUploadResult {
  success: boolean;
  message: string;
  data?: ISocialBuMedia;
  error?: string;
}

class SocialBuMediaService {
  private static instance: SocialBuMediaService;
  private readonly SOCIALBU_UPLOAD_URL = 'https://socialbu.com/api/v1/upload_media';

  private constructor() {}

  public static getInstance(): SocialBuMediaService {
    if (!SocialBuMediaService.instance) {
      SocialBuMediaService.instance = new SocialBuMediaService();
    }
    return SocialBuMediaService.instance;
  }

  /**
   * Upload media to SocialBu and execute upload script
   */
  async uploadMedia(userId: string, mediaData: SocialBuUploadMediaRequest): Promise<MediaUploadResult> {
    try {
      await connectMongo();

      console.log('Starting complete media upload workflow for user:', userId);

      // Get valid token
      const tokenString = await socialBuService.getValidToken();
      if (!tokenString) {
        return {
          success: false,
          message: 'No valid SocialBu token available',
          error: 'Token not found'
        };
      }

      // Call SocialBu upload API
      const response = await axios.post<SocialBuUploadMediaResponse>(
        this.SOCIALBU_UPLOAD_URL,
        {
          name: mediaData.name,
          mime_type: mediaData.mime_type
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${tokenString}`
          }
        }
      );

      if (response.data) {
        console.log('SocialBu upload response received, saving to database...');

        // Create media record with API response
        const mediaRecord = new SocialBuMedia({
          userId,
          name: mediaData.name,
          mime_type: mediaData.mime_type,
          socialbuResponse: {
            name: response.data.name,
            mime_type: response.data.mime_type,
            signed_url: response.data.signed_url,
            key: response.data.key,
            secure_key: response.data.secure_key,
            url: response.data.url
          },
          uploadScript: {
            videoUrl: mediaData.videoUrl || 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            executed: false,
            status: 'pending'
          },
          status: 'pending'
        });

        await mediaRecord.save();
        await mediaRecord.markApiCompleted();

        console.log('Media upload record saved to database:', mediaRecord._id);

        // Execute upload script if videoUrl is provided
        if (mediaData.videoUrl) {
          console.log('Executing upload script...');
          const scriptResult = await this.executeUploadScript(mediaRecord, mediaData.videoUrl);
          
          return {
            success: true,
            message: 'Complete media upload workflow completed',
            data: scriptResult
          };
        }

        return {
          success: true,
          message: 'Media upload API completed successfully. Upload script pending.',
          data: mediaRecord
        };
      }

      return {
        success: false,
        message: 'No response data from SocialBu',
        error: 'Empty response'
      };
    } catch (error) {
      console.error('Error in media upload workflow:', error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const message = (axiosError.response?.data as any)?.message || axiosError.message;
        
        return {
          success: false,
          message: `SocialBu API error: ${message}`,
          error: `HTTP ${status}: ${message}`
        };
      }

      return {
        success: false,
        message: 'Failed to upload media',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute the upload script to upload video to SocialBu
   */
  private async executeUploadScript(mediaRecord: ISocialBuMedia, videoUrl: string): Promise<ISocialBuMedia> {
    try {
      await mediaRecord.markScriptExecuting();
      
      console.log(`🚀 Downloading video from ${videoUrl} and uploading to signed URL...`);

      const signedUrl = mediaRecord.socialbuResponse.signed_url;
      const https = require('https');
      const http = require('http');

      // Choose correct module based on URL protocol
      const client = videoUrl.startsWith("https") ? https : http;

      return new Promise((resolve, reject) => {
        client
          .get(videoUrl, (res: any) => {
            if (res.statusCode !== 200) {
              const error = `Failed to download video: HTTP ${res.statusCode}`;
              console.error(`❌ ${error}`);
              mediaRecord.markScriptFailed(error).then(() => reject(new Error(error)));
              return;
            }

            // Use https for signed URL (it's always https)
            const req = https.request(signedUrl, {
              method: "PUT",
              headers: {
                "x-amz-acl": "private",
                "Content-Length": res.headers['content-length'],
              },
            });

            res.pipe(req);

            req.on("response", async (uploadRes: any) => {
              if (uploadRes.statusCode === 200) {
                console.log("✅ Upload successful!");
                console.log("📊 Response status:", uploadRes.statusCode);
                console.log("📊 Response headers:", uploadRes.headers);
                
                // Extract the clean video URL (without query parameters)
                const finalVideoUrl = signedUrl.split('?')[0];
                console.log("🎥 Your video is now available at:");
                console.log("🔗", finalVideoUrl);
                
                const response: UploadScriptResponse = {
                  statusCode: uploadRes.statusCode,
                  headers: uploadRes.headers,
                  success: true,
                  finalVideoUrl: finalVideoUrl
                };

                await mediaRecord.markScriptCompleted(response);
                resolve(mediaRecord);
              } else {
                const error = `Upload failed: HTTP ${uploadRes.statusCode}`;
                console.error(`❌ ${error}`);
                console.log("📊 Response headers:", uploadRes.headers);
                await mediaRecord.markScriptFailed(error);
                reject(new Error(error));
              }
            });

            req.on("error", async (err: any) => {
              const error = `Upload error: ${err.message}`;
              console.error("❌", error);
              await mediaRecord.markScriptFailed(error);
              reject(new Error(error));
            });
          })
          .on("error", async (err: any) => {
            const error = `Download error: ${err.message}`;
            console.error("❌", error);
            await mediaRecord.markScriptFailed(error);
            reject(new Error(error));
          });
      });
    } catch (error) {
      console.error('Error executing upload script:', error);
      await mediaRecord.markScriptFailed(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get user's media uploads
   */
  async getUserMedia(userId: string): Promise<MediaUploadResult> {
    try {
      await connectMongo();

      const mediaRecords = await SocialBuMedia.findByUserId(userId);

      return {
        success: true,
        message: 'User media retrieved successfully',
        data: mediaRecords as any
      };
    } catch (error) {
      console.error('Error getting user media:', error);
      
      return {
        success: false,
        message: 'Failed to get user media',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update media upload status
   */
  async updateMediaStatus(mediaId: string, status: 'uploaded' | 'failed', errorMessage?: string): Promise<MediaUploadResult> {
    try {
      await connectMongo();

      const mediaRecord = await SocialBuMedia.findById(mediaId);
      if (!mediaRecord) {
        return {
          success: false,
          message: 'Media record not found',
          error: 'Media not found'
        };
      }

      if (status === 'uploaded') {
        await mediaRecord.markAsUploaded();
      } else if (status === 'failed') {
        await mediaRecord.markAsFailed(errorMessage || 'Upload failed');
      }

      return {
        success: true,
        message: 'Media status updated successfully',
        data: mediaRecord
      };
    } catch (error) {
      console.error('Error updating media status:', error);
      
      return {
        success: false,
        message: 'Failed to update media status',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get media by ID
   */
  async getMediaById(mediaId: string): Promise<MediaUploadResult> {
    try {
      await connectMongo();

      const mediaRecord = await SocialBuMedia.findById(mediaId);
      if (!mediaRecord) {
        return {
          success: false,
          message: 'Media record not found',
          error: 'Media not found'
        };
      }

      return {
        success: true,
        message: 'Media retrieved successfully',
        data: mediaRecord
      };
    } catch (error) {
      console.error('Error getting media by ID:', error);
      
      return {
        success: false,
        message: 'Failed to get media',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default SocialBuMediaService.getInstance();
