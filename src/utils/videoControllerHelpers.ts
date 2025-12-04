/**
 * Helper functions for video controller
 */

import https from "https";
import url from "url";
import { Request } from "express";
import { LANGUAGE_MAP } from "../constants/video.constants";
import { VOICE_ENERGY_PRESETS } from "../constants/voiceEnergy";
import DefaultAvatar from "../models/avatar";
import DefaultVoice from "../models/voice";
import PendingCaptions from "../models/PendingCaptions";
import { CaptionGenerationService } from "../services/content";
import { UserVideoSettingsService } from "../services/user";
import UserVideoSettings from "../models/UserVideoSettings";
import { VideoService } from "../services/video";
import VideoSchedule from "../models/VideoSchedule";
import VideoScheduleService from "../services/videoSchedule";
import { AutoSocialPostingService } from "../services/autoSocialPosting.service";
import WorkflowHistory from "../models/WorkflowHistory";
import { notificationService } from "../services/notification.service";
import { SubscriptionService } from "../services/payment";
import { EmailService } from "../services/email.service";

// ==================== WEBHOOK HELPERS ====================
/**
 * Send webhook request with response handling
 */
export function sendWebhookRequest(
  webhookUrl: string,
  data: any,
  callback?: (response: any, statusCode: number) => void
): void {
  const parsedUrl = url.parse(webhookUrl);
  const postData = JSON.stringify(data);
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.path,
    port: parsedUrl.port || 443,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  const webhookReq = https.request(options, (webhookRes: any) => {
    let responseData = "";
    webhookRes.on("data", (chunk: any) => {
      responseData += chunk;
    });
    webhookRes.on("end", () => {
      let parsedResult;
      try {
        parsedResult = JSON.parse(responseData);
      } catch {
        parsedResult = responseData;
      }
      if (callback) {
        callback(parsedResult, webhookRes.statusCode);
      }
    });
  });

  webhookReq.on("error", (error: any) => {
    if (callback) {
      callback({ error: error.message || error }, 500);
    }
  });

  webhookReq.write(postData);
  webhookReq.end();
}

/**
 * Send fire-and-forget webhook request
 */
export function sendFireAndForgetWebhook(webhookUrl: string, data: any): void {
  sendWebhookRequest(webhookUrl, data);
}

// ==================== LANGUAGE HELPERS ====================
/**
 * Map language name to language code
 */
export function mapLanguageToCode(language: string | undefined): string | undefined {
  if (!language || typeof language !== "string") {
    return undefined;
  }

  const languageLower = String(language).toLowerCase().trim();
  return LANGUAGE_MAP[languageLower] || languageLower;
}

/**
 * Get language code from request body or user settings
 */
export async function getLanguageCode(
  bodyLanguage: string | undefined,
  email: string
): Promise<string | undefined> {
  // First, check if language is provided in request body
  if (bodyLanguage) {
    return mapLanguageToCode(bodyLanguage);
  }

  // Fallback: Get from user settings
  try {
    const userVideoSettingsService = new UserVideoSettingsService();
    const userSettings = await userVideoSettingsService.getUserVideoSettings(email);

    if (userSettings?.language) {
      return mapLanguageToCode(userSettings.language);
    }
  } catch (langError) {
    // If language fetch fails, continue without language code
  }

  return undefined;
}

// ==================== VOICE ENERGY HELPERS ====================
/**
 * Get voice energy parameters from request or user settings
 */
export async function getVoiceEnergyParams(
  body: any,
  email: string
): Promise<{
  voiceEnergyParams: (typeof VOICE_ENERGY_PRESETS)[keyof typeof VOICE_ENERGY_PRESETS];
  energyLevel: string;
}> {
  let voiceEnergyParams: (typeof VOICE_ENERGY_PRESETS)[keyof typeof VOICE_ENERGY_PRESETS] =
    VOICE_ENERGY_PRESETS.mid;
  let energyLevel = "mid";

  // Check if energy level is passed in request body (frontend override)
  if (body.energyLevel && ["high", "mid", "low"].includes(body.energyLevel)) {
    energyLevel = body.energyLevel;
    voiceEnergyParams = VOICE_ENERGY_PRESETS[energyLevel as keyof typeof VOICE_ENERGY_PRESETS];
  } else if (
    body.customVoiceEnergy &&
    ["high", "mid", "low"].includes(body.customVoiceEnergy)
  ) {
    energyLevel = body.customVoiceEnergy;
    voiceEnergyParams = VOICE_ENERGY_PRESETS[energyLevel as keyof typeof VOICE_ENERGY_PRESETS];
  } else {
    // Fallback: Get from user's saved settings
    try {
      const userVideoSettingsService = new UserVideoSettingsService();
      const energyProfile = await userVideoSettingsService.getEnergyProfile(email);

      if (energyProfile) {
        voiceEnergyParams = energyProfile.voiceParams;
        energyLevel = energyProfile.voiceEnergy;
      }
    } catch (energyError) {
      // Use defaults
    }
  }

  return { voiceEnergyParams, energyLevel };
}

// ==================== AVATAR HELPERS ====================
/**
 * Get voice ID from avatar gender
 */
export async function getVoiceIdFromAvatar(avatarId: string): Promise<string | undefined> {
  const avatarDoc = await DefaultAvatar.findOne({ avatar_id: avatarId });
  const gender = avatarDoc ? avatarDoc.gender : undefined;

  if (!gender) {
    return undefined;
  }

  const voiceDoc = await DefaultVoice.findOne({ gender });
  return voiceDoc ? voiceDoc.voice_id : undefined;
}

/**
 * Resolve avatar types for multiple avatar IDs
 */
export async function resolveAvatarTypes(
  avatarIds: string[]
): Promise<Record<string, string | undefined>> {
  const avatarTypeById: Record<string, string | undefined> = {};

  if (avatarIds.length === 0) {
    return avatarTypeById;
  }

  const avatars = await DefaultAvatar.find({
    avatar_id: { $in: avatarIds },
  });

  for (const av of avatars) {
    avatarTypeById[av.avatar_id] = (av as any).avatarType;
  }

  return avatarTypeById;
}

// ==================== CAPTION HELPERS ====================
/**
 * Convert videoCaption value to boolean
 */
export function convertVideoCaptionToBoolean(
  value: string | undefined | null
): boolean {
  if (!value) return true; // Default to true if not set
  const normalized = String(value).toLowerCase().trim();
  return normalized === "yes" || normalized === "true";
}

/**
 * Normalize videoCaption for storage (yes/no)
 */
export function normalizeVideoCaptionForStorage(
  value: string | undefined | null
): string {
  if (!value) return "yes"; // Default to "yes" if not set
  const normalized = String(value).toLowerCase().trim();
  if (normalized === "yes" || normalized === "true") return "yes";
  if (normalized === "no" || normalized === "false") return "no";
  return normalized; // Return as-is if not recognized
}

/**
 * Store pending captions for dynamic generation
 */
export async function storePendingCaptionsForDynamicGeneration(
  email: string,
  title: string,
  topic: string,
  keyPoints: string,
  userContext: any,
  userId: string,
  platforms: string[]
): Promise<void> {
  await PendingCaptions.findOneAndUpdate(
    { email, title },
    {
      email,
      title,
      topic,
      keyPoints,
      userContext,
      userId,
      platforms,
      isDynamic: true,
      isPending: true,
      captions: null,
      dynamicPosts: null,
    },
    { upsert: true, new: true }
  );
}

/**
 * Store fallback captions
 */
export async function storeFallbackCaptions(
  email: string,
  title: string,
  topic: string,
  keyPoints: string,
  userContext: any,
  language?: string
): Promise<void> {
  try {
    // Get user settings to retrieve language preference
    const userSettings = await UserVideoSettings.findOne({ email });
    const userLanguage = language || userSettings?.language;

    // Generate traditional captions
    const captions = await CaptionGenerationService.generateCaptions(
      topic,
      keyPoints,
      userContext,
      userLanguage
    );

    await PendingCaptions.findOneAndUpdate(
      { email, title },
      {
        email,
        title,
        captions,
        isDynamic: false,
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    // Silently fail - captions are optional
  }
}

/**
 * Format social media captions response
 */
export function formatSocialMediaCaptions(captions: any): {
  instagram_caption: string | null;
  facebook_caption: string | null;
  linkedin_caption: string | null;
  twitter_caption: string | null;
  tiktok_caption: string | null;
  youtube_caption: string | null;
} {
  const captionsObj = captions || {};
  return {
    instagram_caption: captionsObj.instagram_caption || null,
    facebook_caption: captionsObj.facebook_caption || null,
    linkedin_caption: captionsObj.linkedin_caption || null,
    twitter_caption: captionsObj.twitter_caption || null,
    tiktok_caption: captionsObj.tiktok_caption || null,
    youtube_caption: captionsObj.youtube_caption || null,
  };
}

// ==================== VALIDATION HELPERS ====================
/**
 * Validate required fields
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): { isValid: boolean; missingField?: string } {
  for (const field of requiredFields) {
    if (!body[field] || String(body[field]).trim() === "") {
      return { isValid: false, missingField: field };
    }
  }
  return { isValid: true };
}

/**
 * Generate request ID
 */
export function generateRequestId(prefix: string = "video"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== DOWNLOAD HELPERS ====================
/**
 * Update video auto-generated flag
 */
export async function updateVideoAutoGeneratedFlag(
  videoId: string,
  scheduleId: string | undefined,
  videoService: VideoService
): Promise<void> {
  try {
    await videoService.updateVideoAutoGenerated(videoId, Boolean(scheduleId));
  } catch (autoGenErr) {
    // Silently fail - this is a best-effort operation
  }
}

/**
 * Handle video captions from request or pending captions
 */
export async function handleVideoCaptions(
  videoId: string,
  email: string,
  title: string,
  requestCaptions: any,
  videoService: VideoService
): Promise<void> {
  try {
    if (requestCaptions && typeof requestCaptions === "object") {
      // Use captions from request (manual/custom flow)
      await videoService.updateVideoCaptions(videoId, {
        instagram_caption: requestCaptions.instagram_caption,
        facebook_caption: requestCaptions.facebook_caption,
        linkedin_caption: requestCaptions.linkedin_caption,
        twitter_caption: requestCaptions.twitter_caption,
        tiktok_caption: requestCaptions.tiktok_caption,
        youtube_caption: requestCaptions.youtube_caption,
      });
    } else {
      // Try to consume server-stored pending captions (generated at createVideo)
      try {
        const pending = await PendingCaptions.findOne({ email, title });
        if (pending?.captions) {
          await videoService.updateVideoCaptions(videoId, {
            instagram_caption: pending.captions.instagram_caption,
            facebook_caption: pending.captions.facebook_caption,
            linkedin_caption: pending.captions.linkedin_caption,
            twitter_caption: pending.captions.twitter_caption,
            tiktok_caption: pending.captions.tiktok_caption,
            youtube_caption: pending.captions.youtube_caption,
          });

          // Best-effort cleanup
          try {
            await PendingCaptions.deleteOne({ _id: (pending as any)._id });
          } catch {
            // Silently fail cleanup
          }
        }
      } catch (consumeErr) {
        console.warn(
          "No pending captions found or failed to consume:",
          consumeErr
        );
      }
    }
  } catch (capErr) {
    // Silently fail - captions are optional
  }
}

/**
 * Update workflow history status
 */
export async function updateWorkflowHistoryStatus(
  executionId: string | undefined,
  status: "completed" | "failed",
  errorMessage?: string
): Promise<void> {
  if (!executionId) {
    return;
  }

  try {
    await WorkflowHistory.findOneAndUpdate(
      { executionId },
      {
        status,
        completedAt: new Date(),
        ...(errorMessage ? { errorMessage } : {}),
      }
    );
  } catch (workflowError) {
    // Silently fail - workflow history update is best-effort
  }
}

/**
 * Handle schedule auto-posting asynchronously
 */
export async function handleScheduleAutoPosting(
  scheduleId: string | undefined,
  trendIndex: number | undefined,
  videoId: string,
  videoUrl: string,
  videoTitle: string,
  userId: string,
  videoService: VideoService
): Promise<void> {
  if (!scheduleId || (trendIndex !== 0 && !Number.isInteger(trendIndex))) {
    return;
  }

  try {
    // Idempotency: if already completed, skip posting
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      return;
    }

    const trend = schedule.generatedTrends?.[Number(trendIndex)];
    if (!trend) {
      return;
    }

    if (trend.status === "completed" && trend.videoId) {
      return;
    }

    // Update schedule status to completed and set videoId
    const videoScheduleService = new VideoScheduleService();
    await videoScheduleService.updateVideoStatus(
      String(scheduleId),
      Number(trendIndex),
      "completed",
      videoId
    );

    // Prefer a signed S3 download URL if available
    const readyVideo = await videoService.getVideoWithDownloadUrl(videoId);
    const downloadableUrl = (readyVideo as any)?.downloadUrl || videoUrl;

    // Trigger auto social posting using existing manual code paths
    const autoPoster = new AutoSocialPostingService();
    await autoPoster.postVideoToSocialMedia({
      userId,
      scheduleId: String(scheduleId),
      trendIndex: Number(trendIndex),
      videoUrl: downloadableUrl,
      videoTitle,
    });
  } catch (autoErr) {
    // Silently fail - auto-posting is best-effort
  }
}

/**
 * Mark schedule as failed in error scenario
 */
export async function markScheduleAsFailed(
  scheduleId: string | undefined,
  trendIndex: number | undefined
): Promise<void> {
  if (!scheduleId || (trendIndex !== 0 && !Number.isInteger(trendIndex))) {
    return;
  }

  try {
    const videoScheduleService = new VideoScheduleService();
    await videoScheduleService.updateVideoStatus(
      String(scheduleId),
      Number(trendIndex),
      "failed"
    );
  } catch {
    // Silently fail - error handling is best-effort
  }
}

/**
 * Send error notification to user
 */
export async function sendErrorNotification(
  email: string | undefined,
  errorMessage: string,
  videoService: VideoService
): Promise<void> {
  if (!email) {
    return;
  }

  try {
    const user = await videoService.getUserByEmail(email);
    if (user) {
      notificationService.notifyVideoDownloadProgress(
        user._id.toString(),
        "error",
        "error",
        {
          message: "Failed to download video. Please try again.",
          error: errorMessage,
        }
      );
    }
  } catch (notificationError) {
    // Silently fail - notifications are best-effort
  }
}

// ==================== SUBSCRIPTION HELPERS ====================
/**
 * Check video creation limit and send email if limit reached
 */
export async function checkVideoCreationLimit(
  email: string,
  videoService: VideoService
): Promise<{ canCreate: boolean; limit?: number; remaining?: number; used?: number }> {
  const user = await videoService.getUserByEmail(email);
  if (!user) {
    return { canCreate: false };
  }

  const subscriptionService = new SubscriptionService();
  const videoLimit = await subscriptionService.canCreateVideo(
    user._id.toString()
  );

  if (!videoLimit.canCreate) {
    // Send plan-full email notification
    try {
      const emailService = new EmailService();
      await emailService.send(
        email,
        "Your monthly video limit has been reached",
        `
        <h2>Video Limit Reached</h2>
        <p>You have reached your monthly video limit (${
          videoLimit.limit
        } videos per month).</p>
        <p>You have used ${videoLimit.limit - videoLimit.remaining} out of ${
          videoLimit.limit
        } videos this month.</p>
        <p>Your subscription will renew monthly, allowing you to create more videos next month.</p>
        <p><a href="${
          process.env.FRONTEND_URL || "https://www.edgeairealty.com"
        }" target="_blank">Visit Dashboard</a></p>
        `
      );
    } catch (mailErr) {
      // Email sending failed, but still return error
    }
  }

  return videoLimit;
}

