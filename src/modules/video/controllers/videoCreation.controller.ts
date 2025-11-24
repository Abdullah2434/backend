import { Request, Response } from "express";
import VideoService from "../services/video.service";
import DefaultAvatar from "../../../models/avatar";
import DefaultVoice from "../../../models/voice";
import { UserVideoSettingsService } from "../../../services/userVideoSettings.service";
import { SubscriptionService } from "../../../services/subscription.service";
import { EmailService } from "../../../services/email";
import PendingCaptions from "../../../models/PendingCaptions";
import CaptionGenerationService from "../../../services/captionGeneration.service";
import {
  validateCreateVideo,
  validateGenerateVideo,
} from "../../../validations/video.validations";
import {
  buildCreateVideoWebhookData,
  buildUserContext,
  getEstimatedCompletionTime,
  buildVideoLimitEmailContent,
  buildVideoLimitResponseData,
  buildVideoLimitErrorMessage,
  getEnergyLevelAndParams,
  mapLanguageToCode,
} from "../../../utils/videoHelpers";
import { SOCIAL_PLATFORMS } from "../../../constants/video.constants";
import https from "https";
import url from "url";

const videoService = new VideoService();

/**
 * Create video via webhook
 * POST /api/video/create
 */
export async function createVideo(req: Request, res: Response) {
  try {
    // ⚠️ CRITICAL: Check video limit FIRST before any processing or webhook calls
    // This prevents n8n webhook from being called if user has reached their limit
    const email = String(req.body.email || "").trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to check subscription limits",
      });
    }

    const user = await videoService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
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
          buildVideoLimitEmailContent(
            videoLimit.limit,
            videoLimit.remaining,
            videoLimit.limit - videoLimit.remaining
          )
        );
      } catch (mailErr) {
        // Email sending failed, but still return error
      }

      return res.status(429).json({
        success: false,
        message: buildVideoLimitErrorMessage(
          videoLimit.limit,
          videoLimit.remaining,
          videoLimit.limit - videoLimit.remaining
        ),
        data: buildVideoLimitResponseData(
          videoLimit.limit,
          videoLimit.remaining,
          videoLimit.limit - videoLimit.remaining
        ),
      });
    }

    // Now proceed with field validation
    const validationResult = validateCreateVideo(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const webhookUrl = process.env.VIDEO_CREATION_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({
        success: false,
        message: "Video creation service is not configured",
      });
    }

    const body = validationResult.data!;
    const webhookData = buildCreateVideoWebhookData(body);

    // Generate and store DYNAMIC captions for manual/custom videos using Smart Memory System
    try {
      const topic = String(body.videoTopic || body.name || "").trim();
      const keyPoints = String(body.topicKeyPoints || body.prompt || "").trim();
      if (topic && keyPoints) {
        // Get user ID for dynamic post generation
        const user = await videoService.getUserByEmail(body.email);
        if (user) {
          // Create user context for dynamic posts
          const userContext = buildUserContext(body);

          // Store the dynamic generation data for later processing after webhooks complete
          // This will be triggered by the webhook handlers after both webhooks are done
          await PendingCaptions.findOneAndUpdate(
            {
              email: body.email,
              title: body.videoTopic || topic,
            },
            {
              email: body.email,
              title: body.videoTopic || topic,
              topic,
              keyPoints,
              userContext,
              userId: user._id.toString(),
              platforms: SOCIAL_PLATFORMS,
              isDynamic: true,
              isPending: true, // Flag to indicate this needs dynamic generation
              captions: null, // Will be populated after webhooks complete
              dynamicPosts: null, // Will be populated after webhooks complete
            },
            { upsert: true, new: true }
          );
        } else {
          // Fallback to traditional captions
          const userContext = buildUserContext(body);
          const captions = await CaptionGenerationService.generateCaptions(
            topic,
            keyPoints,
            userContext
          );

          await PendingCaptions.findOneAndUpdate(
            {
              email: body.email,
              title: body.videoTopic || topic,
            },
            {
              email: body.email,
              title: body.videoTopic || topic,
              captions, // ✅ Includes youtube_caption from CaptionGenerationService
              isDynamic: false,
            },
            { upsert: true, new: true }
          );
        }
      }
    } catch (capGenErr) {}
    // Use native node http(s) for webhook POST
    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(webhookData);
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
      let data = "";
      webhookRes.on("data", (chunk: any) => {
        data += chunk;
      });
      webhookRes.on("end", () => {
        let webhookResult;
        try {
          webhookResult = JSON.parse(data);
        } catch {
          webhookResult = data;
        }
        if (webhookRes.statusCode < 200 || webhookRes.statusCode >= 300) {
          return res.status(502).json({
            success: false,
            message: "Failed to create video. Please try again later.",
            error: `Webhook error: ${webhookRes.statusCode}`,
          });
        }
        return res.status(200).json({
          success: true,
          message: "Video creation request submitted successfully",
          data: {
            requestId: webhookData.requestId,
            webhookResponse: webhookResult,
            timestamp: webhookData.timestamp,
            status: "pending",
          },
        });
      });
    });
    webhookReq.on("error", (error: any) => {
      return res.status(500).json({
        success: false,
        message: "Internal server error. Please try again later.",
        error: error.message || error,
      });
    });
    webhookReq.write(postData);
    webhookReq.end();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
      error: error.message,
    });
  }
}

/**
 * Generate video via webhook
 * POST /api/video/generate-video
 */
export async function generateVideo(req: Request, res: Response) {
  try {
    // ⚠️ CRITICAL: Check video limit FIRST before any processing or webhook calls
    // This prevents n8n webhook from being called if user has reached their limit
    const email = String(req.body.email || "").trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to check subscription limits",
      });
    }

    const user = await videoService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
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
          buildVideoLimitEmailContent(
            videoLimit.limit,
            videoLimit.remaining,
            videoLimit.limit - videoLimit.remaining
          )
        );
      } catch (mailErr) {
        // Email sending failed, but still return error
      }

      return res.status(429).json({
        success: false,
        message: buildVideoLimitErrorMessage(
          videoLimit.limit,
          videoLimit.remaining,
          videoLimit.limit - videoLimit.remaining
        ),
        data: buildVideoLimitResponseData(
          videoLimit.limit,
          videoLimit.remaining,
          videoLimit.limit - videoLimit.remaining
        ),
      });
    }

    // Now proceed with field validation
    const validationResult = validateGenerateVideo(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
      });
    }

    const body = validationResult.data!;

    const webhookUrl = process.env.GENERATE_VIDEO_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({
        success: false,
        message: "GENERATE_VIDEO_WEBHOOK_URL environment variable is not set",
      });
    }

    // Get energy profile settings - either from request body or user settings
    let { energyLevel, voiceEnergyParams } = getEnergyLevelAndParams(
      body.energyLevel,
      body.customVoiceEnergy
    );

    // Fallback: Get from user's saved settings if not provided
    if (!body.energyLevel && !body.customVoiceEnergy) {
      try {
        const userVideoSettingsService = new UserVideoSettingsService();
        const energyProfile = await userVideoSettingsService.getEnergyProfile(
          body.email
        );

        if (energyProfile) {
          voiceEnergyParams = energyProfile.voiceParams;
          energyLevel = energyProfile.voiceEnergy;
        }
      } catch (energyError) {}
    }
    const avatarDoc = await DefaultAvatar.findOne({
      avatar_id: body.avatar_title,
    });

    const gender = avatarDoc ? avatarDoc.gender : undefined;
    // Get voice_id from DefaultVoice by gender
    let voice_id: string | undefined = undefined;
    if (gender) {
      const voiceDoc = await DefaultVoice.findOne({ gender });

      voice_id = voiceDoc ? voiceDoc.voice_id : undefined;
    }

    // Resolve avatar types for title/body/conclusion avatars
    const avatarIdsToResolve = [
      String(body.avatar_title || "").trim(),
      String(body.avatar_body || "").trim(),
      String(body.avatar_conclusion || "").trim(),
    ].filter(Boolean) as string[];

    const avatarTypeById: Record<string, string | undefined> = {};
    if (avatarIdsToResolve.length > 0) {
      const avatars = await DefaultAvatar.find({
        avatar_id: { $in: avatarIdsToResolve },
      });
      for (const av of avatars) {
        avatarTypeById[av.avatar_id] = (av as any).avatarType;
      }
    }

    // Get language code - check body.language first (from scheduled video), then userSettings
    let languageCode: string | undefined = mapLanguageToCode(body.language);

    // Fallback: Get from user settings if not provided
    if (!languageCode) {
      try {
        const userVideoSettingsService = new UserVideoSettingsService();
        const userSettings =
          await userVideoSettingsService.getUserVideoSettings(body.email);

        if (userSettings?.language) {
          languageCode = mapLanguageToCode(userSettings.language);
        }
      } catch (langError) {
        // If language fetch fails, continue without language code
      }
    }

    // Store caption generation data for asynchronous processing after webhook
    // Caption generation will happen after n8n webhook completes (second hook)
    try {
      // Get user ID for dynamic post generation
      const user = await videoService.getUserByEmail(body.email);
      if (user) {
        // Create user context for dynamic posts
        const userContext = buildUserContext(body);

        // Store the dynamic generation data for later processing after webhook completes
        await PendingCaptions.findOneAndUpdate(
          {
            email: body.email,
            title: body.title,
          },
          {
            email: body.email,
            title: body.title,
            topic: body.title || body.hook,
            keyPoints: `${body.hook} ${body.body} ${body.conclusion}`,
            userContext,
            userId: user._id.toString(),
            platforms: SOCIAL_PLATFORMS,
            isDynamic: true,
            isPending: true, // Will be processed after webhook completes
            captions: null, // Will be populated after generation
            dynamicPosts: null, // Will be populated after generation
          },
          { upsert: true, new: true }
        );
      } else {
        // Store fallback data
        await PendingCaptions.findOneAndUpdate(
          {
            email: body.email,
            title: body.title,
          },
          {
            email: body.email,
            title: body.title,
            topic: body.title || body.hook,
            keyPoints: `${body.hook} ${body.body} ${body.conclusion}`,
            userContext: buildUserContext(body),
            isDynamic: false,
            isPending: true,
            captions: null,
          },
          { upsert: true, new: true }
        );
      }
    } catch (capGenErr) {}

    const webhookData = {
      hook: {
        audio: body.hook,
        avatar: body.avatar_title,
        avatarType: avatarTypeById[String(body.avatar_title || "").trim()],
      },
      body: {
        audio: body.body,
        avatar: body.avatar_body,
        text: body.text,
        avatarType: avatarTypeById[String(body.avatar_body || "").trim()],
      },
      conclusion: {
        audio: body.conclusion,
        avatar: body.avatar_conclusion,
        avatarType: avatarTypeById[String(body.avatar_conclusion || "").trim()],
      },
      company_name: body.company_name,
      social_handles: body.social_handles,
      license: body.license,
      email: body.email,
      title: body.title,
      voice: voice_id, // backward compatibility
      voice_id: voice_id,
      isDefault: avatarDoc?.default,
      timestamp: new Date().toISOString(),
      ...(languageCode ? { language: languageCode } : {}), // Add language code if available
      // New voice energy parameters
      voiceEnergy: {
        stability: voiceEnergyParams.stability,
        similarity_boost: voiceEnergyParams.similarity_boost,
        style: voiceEnergyParams.style,
        use_speaker_boost: voiceEnergyParams.use_speaker_boost,
        speed: voiceEnergyParams.speed,
      },
      // Energy level for reference
      energyLevel: energyLevel,
      // Music URL from frontend (string .mp3) - passed directly to N8N
      ...(body.music && typeof body.music === "string"
        ? { music: body.music }
        : {}),
      // Optional schedule context for auto runs (forward to N8N)
      ...(body.scheduleId ? { scheduleId: body.scheduleId } : {}),
      ...(body.trendIndex !== undefined
        ? { trendIndex: Number(body.trendIndex) }
        : {}),
      ...(body.scheduleId !== undefined || body.trendIndex !== undefined
        ? { isScheduled: true }
        : {}),
    } as any;

    // Fire and forget: send request to n8n webhook and return immediately
    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(webhookData);
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
      webhookRes.on("data", () => {}); // ignore data
      webhookRes.on("end", () => {});
    });
    webhookReq.on("error", (error: any) => {});
    webhookReq.write(postData);
    webhookReq.end();
    // Return immediately with request info
    const response = {
      success: true,
      message: "Video generation started successfully",
      data: {
        status: "processing",
        timestamp: new Date().toISOString(),
        estimated_completion: getEstimatedCompletionTime(),
        note: "Video generation is running in the background. The video will be available when ready.",
      },
    };

    return res.json(response);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
      error: error.message || "Unknown error occurred",
    });
  }
}

