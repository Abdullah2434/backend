import axios from "axios";
import DefaultAvatar from "../../../models/avatar";
import DefaultVoice from "../../../models/voice";
import { connectMongo } from "../../../config/mongoose";
import { logger } from "../../../core/utils/logger";
import { JobResult } from "../types/job.types";

const HEYGEN_BASE_URL = process.env.HEYGEN_BASE_URL;
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

/**
 * Fetch and store default avatars from HeyGen API
 */
export async function syncAvatars(): Promise<JobResult> {
  const startTime = Date.now();

  try {
    await connectMongo();

    const response = await axios.get(`${HEYGEN_BASE_URL}/avatars`, {
      headers: {
        accept: "application/json",
        "x-api-key": HEYGEN_API_KEY,
      },
    });

    const avatars = response.data.data?.avatars || [];
    let created = 0;
    let skipped = 0;

    for (const avatar of avatars) {
      const exists = await DefaultAvatar.findOne({
        avatar_id: avatar.avatar_id,
      });

      if (!exists) {
        await DefaultAvatar.create({
          avatar_id: avatar.avatar_id,
          avatar_name: avatar.avatar_name,
          gender: avatar.gender,
          preview_image_url: avatar.preview_image_url,
          preview_video_url: avatar.preview_video_url,
          default: true,
          status: "ready",
        });
        created++;
      } else {
        skipped++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info("Avatar sync completed", {
      total: avatars.length,
      created,
      skipped,
      duration,
    });

    return {
      success: true,
      message: `Avatar sync completed: ${created} created, ${skipped} skipped`,
      data: { total: avatars.length, created, skipped },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Avatar sync failed", error);

    return {
      success: false,
      message: "Avatar sync failed",
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}

/**
 * Fetch and store default voices from HeyGen API
 */
export async function syncVoices(): Promise<JobResult> {
  const startTime = Date.now();

  try {
    await connectMongo();

    const response = await axios.get(`${HEYGEN_BASE_URL}/voices`, {
      headers: {
        accept: "application/json",
        "x-api-key": HEYGEN_API_KEY,
      },
    });

    const voices = response.data.data?.voices || [];
    let created = 0;
    let skipped = 0;

    for (const voice of voices) {
      // Only create if preview_audio exists and is a non-empty string
      if (!voice.preview_audio) continue;

      const exists = await DefaultVoice.findOne({ voice_id: voice.voice_id });

      if (!exists) {
        await DefaultVoice.create({
          voice_id: voice.voice_id,
          language: voice.language,
          gender: voice.gender,
          name: voice.name,
          preview_audio: voice.preview_audio,
        });
        created++;
      } else {
        skipped++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info("Voice sync completed", {
      total: voices.length,
      created,
      skipped,
      duration,
    });

    return {
      success: true,
      message: `Voice sync completed: ${created} created, ${skipped} skipped`,
      data: { total: voices.length, created, skipped },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Voice sync failed", error);

    return {
      success: false,
      message: "Voice sync failed",
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}

/**
 * Combined avatar and voice sync job
 */
export async function syncAvatarsAndVoices(): Promise<JobResult> {
  const startTime = Date.now();

  logger.info("Starting avatar and voice sync job...");

  const [avatarResult, voiceResult] = await Promise.all([
    syncAvatars(),
    syncVoices(),
  ]);

  const duration = Date.now() - startTime;

  if (avatarResult.success && voiceResult.success) {
    return {
      success: true,
      message: "Avatar and voice sync completed successfully",
      data: {
        avatars: avatarResult.data,
        voices: voiceResult.data,
      },
      duration,
    };
  }

  return {
    success: false,
    message: "Avatar and/or voice sync failed",
    data: {
      avatars: avatarResult,
      voices: voiceResult,
    },
    duration,
  };
}
