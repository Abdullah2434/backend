import axios, { AxiosError } from 'axios';
import SocialBuMedia, { ISocialBuMedia } from '../../models/SocialBuMedia';
import { connectMongo } from '../../config/mongoose';
import socialBuService from './socialbu.service';
import {
  SOCIALBU_UPLOAD_URL,
  HTTP_STATUS_OK,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DEFAULT_HEADERS,
} from '../../constants/socialbuService.constants';
import {
  SocialBuUploadMediaRequest,
  SocialBuUploadMediaResponse,
  UploadScriptResponse,
  MediaUploadResult,
} from '../../types/socialbuService.types';
import {
  buildAuthHeaders,
  getHttpClient,
  extractCleanUrl,
  buildUploadScriptResponse,
  buildMediaRecordData,
} from '../../utils/socialbuServiceHelpers';

class SocialBuMediaService {
  private static instance: SocialBuMediaService;

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


      // Get valid token
      const tokenString = await socialBuService.getValidToken();
      if (!tokenString) {
        return {
          success: false,
          message: ERROR_MESSAGES.NO_TOKEN_AVAILABLE,
          error: ERROR_MESSAGES.TOKEN_NOT_FOUND
        };
      }

      // Call SocialBu upload API
      const response = await axios.post<SocialBuUploadMediaResponse>(
        SOCIALBU_UPLOAD_URL,
        {
          name: mediaData.name,
          mime_type: mediaData.mime_type
        },
        {
          headers: buildAuthHeaders(tokenString)
        }
      );

      if (response.data) {
        // Create media record with API response
        const mediaRecordData = buildMediaRecordData(userId, mediaData, response.data);
        const mediaRecord = new SocialBuMedia(mediaRecordData);

        await mediaRecord.save();
        await mediaRecord.markApiCompleted();

        // Execute upload script if videoUrl is provided
        if (mediaData.videoUrl) {
          const scriptResult = await this.executeUploadScript(mediaRecord, mediaData.videoUrl);
          
          return {
            success: true,
            message: SUCCESS_MESSAGES.MEDIA_UPLOAD_COMPLETE,
            data: scriptResult
          };
        }

        return {
          success: true,
          message: SUCCESS_MESSAGES.MEDIA_UPLOAD_API_COMPLETE,
          data: mediaRecord
        };
      }

      return {
        success: false,
        message: ERROR_MESSAGES.NO_RESPONSE_DATA,
        error: ERROR_MESSAGES.EMPTY_RESPONSE
      };
    } catch (error) {

      
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
        message: ERROR_MESSAGES.FAILED_TO_UPLOAD_MEDIA,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
      };
    }
  }

  /**
   * Execute the upload script to upload video to SocialBu
   */
  private async executeUploadScript(mediaRecord: ISocialBuMedia, videoUrl: string): Promise<ISocialBuMedia> {
    try {
      await mediaRecord.markScriptExecuting();
      


      const signedUrl = mediaRecord.socialbuResponse.signed_url;
      const https = require('https');
      const http = require('http');

      // Choose correct module based on URL protocol
      const client = getHttpClient(videoUrl);

      return new Promise((resolve, reject) => {
        client
          .get(videoUrl, (res: any) => {
            if (res.statusCode !== 200) {
              const error = `Failed to download video: HTTP ${res.statusCode}`;

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
              if (uploadRes.statusCode === HTTP_STATUS_OK) {
                // Extract the clean video URL (without query parameters)
                const finalVideoUrl = extractCleanUrl(signedUrl);
                
                const response = buildUploadScriptResponse(
                  uploadRes.statusCode,
                  uploadRes.headers,
                  finalVideoUrl
                );

                await mediaRecord.markScriptCompleted(response);
                resolve(mediaRecord);
              } else {
                const error = `Upload failed: HTTP ${uploadRes.statusCode}`;
               
                await mediaRecord.markScriptFailed(error);
                reject(new Error(error));
              }
            });

            req.on("error", async (err: any) => {
              const error = `Upload error: ${err.message}`;

              await mediaRecord.markScriptFailed(error);
              reject(new Error(error));
            });
          })
          .on("error", async (err: any) => {
            const error = `Download error: ${err.message}`;
 
            await mediaRecord.markScriptFailed(error);
            reject(new Error(error));
          });
      });
    } catch (error) {

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

      const mediaRecords = await SocialBuMedia.find({ userId }).sort({ createdAt: -1 });

      return {
        success: true,
        message: SUCCESS_MESSAGES.USER_MEDIA_RETRIEVED,
        data: mediaRecords as any
      };
    } catch (error) {

      
      return {
        success: false,
        message: ERROR_MESSAGES.FAILED_TO_GET_USER_MEDIA,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
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
        message: SUCCESS_MESSAGES.MEDIA_STATUS_UPDATED,
        data: mediaRecord
      };
    } catch (error) {
 
      
      return {
        success: false,
        message: ERROR_MESSAGES.FAILED_TO_UPDATE_MEDIA_STATUS,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
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
          message: ERROR_MESSAGES.MEDIA_NOT_FOUND,
          error: ERROR_MESSAGES.MEDIA_NOT_FOUND
        };
      }

      return {
        success: true,
        message: SUCCESS_MESSAGES.MEDIA_RETRIEVED,
        data: mediaRecord
      };
    } catch (error) {

      
      return {
        success: false,
        message: ERROR_MESSAGES.FAILED_TO_GET_MEDIA,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
      };
    }
  }
}

export default SocialBuMediaService.getInstance();
