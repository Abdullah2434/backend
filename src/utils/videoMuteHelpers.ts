import { tmpdir } from "os";
import { join } from "path";
import crypto from "crypto";
import { MuteVideoResult, MuteVideoProcessResult, MuteVideoFailedResult } from "../types/services/videoMute.types";

// ==================== CONSTANTS ====================
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const DEFAULT_CONTENT_TYPE = "video/mp4";
const MUTED_VIDEO_BUCKET = "muted-video";

// ==================== FILE PATH UTILITIES ====================
/**
 * Generate temporary input file path
 */
export function generateTempInputFilePath(): string {
  const tempDir = tmpdir();
  return join(
    tempDir,
    `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
  );
}

/**
 * Generate temporary output file path
 */
export function generateTempOutputFilePath(): string {
  const tempDir = tmpdir();
  return join(
    tempDir,
    `muted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
  );
}

// ==================== S3 UTILITIES ====================
/**
 * Generate S3 key for muted video
 */
export function generateMutedVideoS3Key(): string {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString("hex");
  return `${timestamp}_${randomId}.mp4`;
}

/**
 * Get muted video bucket name
 */
export function getMutedVideoBucketName(): string {
  return MUTED_VIDEO_BUCKET;
}

// ==================== VIDEO DOWNLOAD ====================
/**
 * Download video from URL
 */
export async function downloadVideoFromUrl(videoUrl: string): Promise<{
  buffer: ArrayBuffer;
  contentType: string;
}> {
  const videoResponse = await fetch(videoUrl, {
    method: "GET",
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
    },
  });

  if (!videoResponse.ok) {
    throw new Error(
      `Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`
    );
  }

  const videoBuffer = await videoResponse.arrayBuffer();
  const contentType =
    videoResponse.headers.get("content-type") || DEFAULT_CONTENT_TYPE;

  return {
    buffer: videoBuffer,
    contentType,
  };
}

// ==================== RESULT PROCESSING ====================
/**
 * Process Promise.allSettled results for video muting
 */
export function processMuteVideoResults(
  results: PromiseSettledResult<MuteVideoResult>[],
  videoUrls: string[]
): {
  successful: MuteVideoProcessResult[];
  failed: MuteVideoFailedResult[];
} {
  const successful: MuteVideoProcessResult[] = [];
  const failed: MuteVideoFailedResult[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successful.push({
        url: videoUrls[index],
        result: result.value,
      });
    } else {
      const errorMsg = result.reason?.message || "Unknown error";
      failed.push({
        index: index + 1,
        url: videoUrls[index],
        error: errorMsg,
      });
    }
  });

  return { successful, failed };
}

/**
 * Validate that at least one video was successfully muted
 */
export function validateMuteResults(
  successful: MuteVideoProcessResult[],
  failed: MuteVideoFailedResult[]
): void {
  if (successful.length === 0) {
    throw new Error(
      `All videos failed to mute. Errors: ${failed
        .map((f) => `Video ${f.index}: ${f.error}`)
        .join("; ")}`
    );
  }
}

