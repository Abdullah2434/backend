import { ValidationError } from "../types";
import {
  MuteVideoProcessResult,
  MuteVideoFailedResult,
} from "../types/services/videoMute.types";
import axios from "axios";
import path from "path";
import os from "os";

// ==================== CONTROLLER HELPER FUNCTIONS ====================

/**
 * Build response data from muted URLs
 */
export function buildResponseData(
  originalUrls: string[],
  urlToMutedUrlMap: Map<string, string>
): { urls: string[] }[] {
  const responseData: { urls: string[] }[] = [];

  for (const originalUrl of originalUrls) {
    const mutedUrl = urlToMutedUrlMap.get(originalUrl);

    // Only include successful mutes
    if (mutedUrl) {
      responseData.push({ urls: [mutedUrl] });
    }
    // Skip failed URLs to maintain clean response
  }

  return responseData;
}

/**
 * Build URL to muted URL mapping from service results
 */
export function buildUrlMapping(
  results: Array<{ url: string; result: { url: string } }>
): Map<string, string> {
  const urlToMutedUrlMap = new Map<string, string>();
  results.forEach(({ url, result }) => {
    urlToMutedUrlMap.set(url, result.url);
  });
  return urlToMutedUrlMap;
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

/**
 * Check if validation error message indicates missing URLs
 */
export function hasMissingUrlsError(errors: ValidationError[]): boolean {
  return errors.some((err) =>
    err.message.toLowerCase().includes("at least one")
  );
}

// ==================== SERVICE-LEVEL UTILITY FUNCTIONS ====================

/**
 * Generate temporary input file path
 */
export function generateTempInputFilePath(): string {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  return path.join(os.tmpdir(), `video-input-${uniqueSuffix}.mp4`);
}

/**
 * Generate temporary output file path
 */
export function generateTempOutputFilePath(): string {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  return path.join(os.tmpdir(), `video-output-${uniqueSuffix}.mp4`);
}

/**
 * Generate S3 key for muted video
 */
export function generateMutedVideoS3Key(): string {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  return `muted-videos/${timestamp}_${random}.mp4`;
}

/**
 * Get muted video bucket name from environment
 */
export function getMutedVideoBucketName(): string {
  return (
    process.env.AWS_S3_MUTED_VIDEO_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    "muted-videos"
  );
}

/**
 * Download video from URL
 */
export async function downloadVideoFromUrl(
  videoUrl: string
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  try {
    const response = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 300000, // 5 minutes timeout
      maxContentLength: 1000 * 1024 * 1024, // 1GB max
    });

    return {
      buffer: response.data,
      contentType: response.headers["content-type"] || "video/mp4",
    };
  } catch (error: any) {
    throw new Error(
      `Failed to download video from URL: ${error.message || "Unknown error"}`
    );
  }
}

/**
 * Process mute video results from Promise.allSettled
 */
export function processMuteVideoResults(
  results: PromiseSettledResult<any>[],
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
      failed.push({
        index,
        url: videoUrls[index],
        error: result.reason?.message || "Unknown error",
      });
    }
  });

  return { successful, failed };
}

/**
 * Validate mute results - ensure at least one video was successfully muted
 */
export function validateMuteResults(
  successful: MuteVideoProcessResult[],
  failed: MuteVideoFailedResult[]
): void {
  if (successful.length === 0) {
    const errorMessages = failed.map((f) => `${f.url}: ${f.error}`).join("; ");
    throw new Error(
      `All videos failed to mute. Errors: ${errorMessages || "Unknown errors"}`
    );
  }
}
