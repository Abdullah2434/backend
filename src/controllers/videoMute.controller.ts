import { Request, Response } from "express";
import { VideoMuteService } from "../services/videoMute.service";
import { ResponseHelper } from "../utils/responseHelper";
import { validateMuteVideo } from "../validations/videoMute.validations";
import {
  buildResponseData,
  buildUrlMapping,
  getErrorStatus,
  hasMissingUrlsError,
} from "../utils/videoMuteHelpers";

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Mute video audio
 * POST /api/video-mute
 */
export async function muteVideo(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = validateMuteVideo(req.body);

    if (!validationResult.success) {
      // Check for specific validation errors
      if (hasMissingUrlsError(validationResult.errors || [])) {
        return ResponseHelper.badRequest(
          res,
          "At least one video URL is required"
        );
      }

      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    // Get normalized URLs (already validated and normalized by schema)
    const urlsToProcess = validationResult.data!;

    // Process videos
    const videoMuteService = new VideoMuteService();
    const results = await videoMuteService.muteVideosFromUrls(urlsToProcess);

    // Build URL mapping
    const urlToMutedUrlMap = buildUrlMapping(results);

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
