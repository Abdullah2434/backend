import { Request, Response } from "express";
import { VideoMuteService } from "../services/videoMute.service";
import { ResponseHelper } from "../utils/responseHelper";
import { muteVideoSchema } from "../validations/videoMute.validations";

// ==================== HELPER FUNCTIONS ====================
/**
 * Normalize request body to array format
 * Handles both array and object with numeric keys (URL-encoded form data)
 */
function normalizeRequestBody(body: any): string[] {
  // If already an array, return it
  if (Array.isArray(body)) {
    return body;
  }

  // If object with numeric keys, convert to array
  if (typeof body === "object" && body !== null) {
    const keys = Object.keys(body);
    const allNumericKeys = keys.every((key) => /^\d+$/.test(key));

    if (allNumericKeys && keys.length > 0) {
      return keys
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        .map((key) => body[key])
        .filter(
          (url): url is string => typeof url === "string" && url.trim() !== ""
        );
    }
  }

  throw new Error(
    "Request body must be an array of video URLs or object with numeric keys"
  );
}

/**
 * Validate and normalize URLs
 */
function validateAndNormalizeUrls(urls: any[]): string[] {
  const normalizedUrls: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    // Validate each URL is a string
    if (typeof url !== "string" || url.trim() === "") {
      throw new Error(`Invalid URL at index ${i}: must be a non-empty string`);
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL format at index ${i}: ${url}`);
    }

    normalizedUrls.push(url.trim());
  }

  return normalizedUrls;
}

/**
 * Build response data from muted URLs
 */
function buildResponseData(
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
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Mute video audio
 * POST /api/video-mute
 */
export async function muteVideo(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = muteVideoSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      // Check for specific validation errors
      const errorMessages = validationResult.error.errors.map((e) => e.message);
      if (errorMessages.some((msg) => msg.includes("at least one"))) {
        return ResponseHelper.badRequest(
          res,
          "At least one video URL is required"
        );
      }

      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Get normalized URLs
    let urlsToProcess: string[];
    try {
      urlsToProcess = normalizeRequestBody(validationResult.data);
      urlsToProcess = validateAndNormalizeUrls(urlsToProcess);
    } catch (error: any) {
      return ResponseHelper.badRequest(res, error.message);
    }

    // Process videos
    const videoMuteService = new VideoMuteService();
    const results = await videoMuteService.muteVideosFromUrls(urlsToProcess);

    // Build URL mapping
    const urlToMutedUrlMap = new Map<string, string>();
    results.forEach(({ url, result }) => {
      urlToMutedUrlMap.set(url, result.url);
    });

    // Build response data
    const responseData = buildResponseData(urlsToProcess, urlToMutedUrlMap);

    // Return in the format: [{ "urls": ["muted-url"] }, ...]
    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error("Error in muteVideo:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to mute video audio",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
