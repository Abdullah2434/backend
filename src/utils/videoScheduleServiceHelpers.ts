/**
 * Helper functions for VideoSchedule services
 */

import https from "https";
import http from "http";
import { URL } from "url";
import VideoSchedule from "../models/VideoSchedule";
import ElevenLabsVoice from "../models/elevenLabsVoice";
import MusicTrack from "../models/MusicTrack";
import { S3Service } from "../services/s3.service";
import {
  API_BASE_URL,
  CREATE_VIDEO_ENDPOINT,
  GENERATE_VIDEO_ENDPOINT,
  HTTP_STATUS_SUCCESS_MIN,
  HTTP_STATUS_SUCCESS_MAX,
  ERROR_MESSAGES,
  DEFAULT_ZIP_CODE,
  DEFAULT_ZIP_KEYPOINTS,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_MUSIC_URL_EXPIRY,
  LANGUAGE_MAP,
  VOICE_PRESET_LOW,
  VOICE_PRESET_MEDIUM,
  VOICE_PRESET_HIGH,
  AWS_REGION,
  AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} from "../constants/videoScheduleService.constants";
import { EnhancedContent, VoiceSettings } from "../types/videoScheduleService.types";

// ==================== API CALL HELPERS ====================
/**
 * Make HTTP request to API
 */
export function makeAPIRequest(
  url: string,
  method: string,
  data: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(data);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const request = protocol.request(options, (res: any) => {
      let responseData = "";
      res.on("data", (chunk: any) => {
        responseData += chunk;
      });
      res.on("end", () => {
        if (
          res.statusCode >= HTTP_STATUS_SUCCESS_MIN &&
          res.statusCode <= HTTP_STATUS_SUCCESS_MAX
        ) {
          resolve(responseData);
        } else {
          reject(
            new Error(`${method} request failed: ${res.statusCode}`)
          );
        }
      });
    });

    request.on("error", (error: any) => {
      reject(error);
    });

    request.write(postData);
    request.end();
  });
}

/**
 * Extract enhanced content from API response
 */
export function extractEnhancedContent(responseData: string): EnhancedContent | null {
  try {
    const response = JSON.parse(responseData);
    const webhookResponse = response.data?.webhookResponse;

    if (!webhookResponse) {
      return null;
    }

    const cleanText = (text: string): string => {
      return decodeURIComponent(text || "")
        .replace(/\\n\\n/g, " ")
        .replace(/\n\n/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\n/g, " ")
        .trim();
    };

    return {
      hook: cleanText(webhookResponse.hook || ""),
      body: cleanText(webhookResponse.body || ""),
      conclusion: cleanText(webhookResponse.conclusion || ""),
    };
  } catch (parseError) {
    return null;
  }
}

/**
 * Call Create Video API
 */
export async function callCreateVideoAPI(data: any): Promise<EnhancedContent | null> {
  const url = `${API_BASE_URL}${CREATE_VIDEO_ENDPOINT}`;
  const responseData = await makeAPIRequest(url, "POST", data);
  return extractEnhancedContent(responseData);
}

/**
 * Call Generate Video API
 */
export async function callGenerateVideoAPI(data: any): Promise<void> {
  const url = `${API_BASE_URL}${GENERATE_VIDEO_ENDPOINT}`;
  await makeAPIRequest(url, "POST", data);
}

// ==================== AVATAR HELPERS ====================
/**
 * Extract avatar ID from value
 */
export function extractAvatarId(avatarValue: any): string {
  if (!avatarValue) return "";
  if (typeof avatarValue === "string") return avatarValue.trim();
  if (typeof avatarValue === "object" && avatarValue.avatar_id)
    return String(avatarValue.avatar_id).trim();
  return "";
}

/**
 * Extract avatar type from value
 */
export function extractAvatarType(avatarValue: any): string {
  if (typeof avatarValue === "object" && avatarValue.avatarType)
    return String(avatarValue.avatarType).trim();
  return "video_avatar";
}

/**
 * Get voice ID from avatar gender
 */
export async function getVoiceIdFromAvatarGender(
  avatarId: string
): Promise<string | undefined> {
  try {
    const DefaultAvatar = require("../models/avatar").default;
    const avatarDoc = await DefaultAvatar.findOne({ avatar_id: avatarId });

    if (!avatarDoc?.gender) {
      return undefined;
    }

    const DefaultVoice = require("../models/voice").default;
    const voiceDoc = await DefaultVoice.findOne({ gender: avatarDoc.gender });
    return voiceDoc?.voice_id;
  } catch (error) {
    return undefined;
  }
}

// ==================== VOICE SETTINGS HELPERS ====================
/**
 * Get voice settings by preset
 */
export function getVoiceSettingsByPreset(
  preset: string
): VoiceSettings | null {
  const presetLower = preset?.toLowerCase().trim();

  if (presetLower === "low") {
    return VOICE_PRESET_LOW;
  } else if (presetLower === "medium" || presetLower === "mid") {
    return VOICE_PRESET_MEDIUM;
  } else if (presetLower === "high") {
    return VOICE_PRESET_HIGH;
  }

  return null;
}

/**
 * Get voice settings for cloned voice
 */
export async function getVoiceSettingsForClonedVoice(
  voiceId: string,
  userPreset?: string
): Promise<VoiceSettings | undefined> {
  try {
    const voice = await ElevenLabsVoice.findOne({ voice_id: voiceId });
    if (!voice) {
      return undefined;
    }

    const voiceCategory = voice.category?.toLowerCase().trim();
    if (voiceCategory !== "cloned") {
      return undefined;
    }

    if (userPreset) {
      return getVoiceSettingsByPreset(userPreset) || undefined;
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}

// ==================== MUSIC HELPERS ====================
/**
 * Extract S3 key from URL
 */
export function extractS3KeyFromUrl(url: string): string | null {
  try {
    // If it's already a key (no http/https), return as is
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return url;
    }

    // If it's a URL, extract the path
    const urlObj = new URL(url);
    let s3Key = urlObj.pathname;

    // Remove leading slash
    if (s3Key.startsWith("/")) {
      s3Key = s3Key.substring(1);
    }

    // Remove bucket name if present in path
    const bucketEnv = AWS_S3_BUCKET || "";
    const bucketName = bucketEnv.split("/")[0];
    if (bucketName && s3Key.startsWith(bucketName + "/")) {
      s3Key = s3Key.substring(bucketName.length + 1);
    }

    return s3Key;
  } catch (error) {
    return null;
  }
}

/**
 * Get music URL from track ID
 */
export async function getMusicUrlFromTrackId(
  trackId: string
): Promise<string | undefined> {
  try {
    const musicTrack = await MusicTrack.findById(trackId);
    if (!musicTrack?.s3FullTrackUrl) {
      return undefined;
    }

    const s3Key = extractS3KeyFromUrl(musicTrack.s3FullTrackUrl);
    if (!s3Key) {
      return undefined;
    }

    // Ensure key ends with .mp3
    const finalS3Key = s3Key.endsWith(".mp3") ? s3Key : s3Key + ".mp3";

    // Convert S3 key to clean MP3 URL
    const s3Service = new S3Service({
      region: AWS_REGION,
      bucketName: AWS_S3_BUCKET,
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    });

    let musicUrl = await s3Service.getMusicTrackUrl(
      finalS3Key,
      DEFAULT_MUSIC_URL_EXPIRY
    );

    // Ensure URL ends with .mp3
    if (!musicUrl.endsWith(".mp3")) {
      musicUrl = musicUrl + ".mp3";
    }

    return musicUrl;
  } catch (error) {
    return undefined;
  }
}

// ==================== LANGUAGE HELPERS ====================
/**
 * Map language name to language code
 */
export function mapLanguageToCode(language?: string): string | undefined {
  if (!language) {
    return undefined;
  }

  const languageLower = String(language).toLowerCase().trim();
  return LANGUAGE_MAP[languageLower] || languageLower;
}

// ==================== CAPTION HELPERS ====================
/**
 * Convert video caption value to boolean
 */
export function convertVideoCaptionToBoolean(
  value: string | undefined | null
): boolean {
  if (!value) return true; // Default to true if not set
  const normalized = String(value).toLowerCase().trim();
  return normalized === "yes" || normalized === "true";
}

/**
 * Get dynamic caption from generated posts
 */
export function getDynamicCaption(
  dynamicPosts: any[],
  platform: string
): string {
  const post = dynamicPosts.find((p) => p.platform === platform);
  if (post && post.content) {
    return post.content;
  }
  return "Real Estate Update - Check out the latest market insights!";
}

/**
 * Build caption update object for database
 */
export function buildCaptionUpdateObject(
  trendIndex: number,
  captions: {
    instagram_caption: string;
    facebook_caption: string;
    linkedin_caption: string;
    twitter_caption: string;
    tiktok_caption: string;
    youtube_caption: string;
  }
): Record<string, any> {
  return {
    [`generatedTrends.${trendIndex}.instagram_caption`]: captions.instagram_caption,
    [`generatedTrends.${trendIndex}.facebook_caption`]: captions.facebook_caption,
    [`generatedTrends.${trendIndex}.linkedin_caption`]: captions.linkedin_caption,
    [`generatedTrends.${trendIndex}.twitter_caption`]: captions.twitter_caption,
    [`generatedTrends.${trendIndex}.tiktok_caption`]: captions.tiktok_caption,
    [`generatedTrends.${trendIndex}.youtube_caption`]: captions.youtube_caption,
    [`generatedTrends.${trendIndex}.enhanced_with_dynamic_posts`]: true,
    [`generatedTrends.${trendIndex}.caption_status`]: "ready",
    [`generatedTrends.${trendIndex}.caption_processed_at`]: new Date(),
  };
}

// ==================== POST ID HELPERS ====================
/**
 * Parse post ID to get index
 */
export function parsePostId(postId: string): number {
  const parts = postId.split("_");
  if (parts.length !== 2) {
    throw new Error(ERROR_MESSAGES.INVALID_POST_ID_FORMAT);
  }

  const postIndex = parseInt(parts[1]);
  if (isNaN(postIndex)) {
    throw new Error(ERROR_MESSAGES.INVALID_POST_ID_FORMAT);
  }

  return postIndex;
}

/**
 * Validate post index
 */
export function validatePostIndex(
  postIndex: number,
  trendsLength: number
): void {
  if (postIndex < 0 || postIndex >= trendsLength) {
    throw new Error(ERROR_MESSAGES.POST_INDEX_OUT_OF_RANGE);
  }
}

// ==================== SCHEDULE HELPERS ====================
/**
 * Build basic caption for trend
 */
export function buildBasicCaption(description: string, keypoints: string): string {
  return `${description} - ${keypoints}`;
}

/**
 * Build basic captions object for trend
 */
export function buildBasicCaptions(description: string, keypoints: string) {
  const basicCaption = buildBasicCaption(description, keypoints);
  return {
    instagram_caption: basicCaption,
    facebook_caption: basicCaption,
    linkedin_caption: basicCaption,
    twitter_caption: basicCaption,
    tiktok_caption: basicCaption,
    youtube_caption: basicCaption,
    enhanced_with_dynamic_posts: false,
    caption_status: "pending",
  };
}

/**
 * Normalize trend description for duplicate checking
 */
export function normalizeTrendDescription(description: string): string {
  return description.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Generate request ID for scheduled video
 */
export function generateScheduledVideoRequestId(): string {
  return `scheduled_video_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
}

