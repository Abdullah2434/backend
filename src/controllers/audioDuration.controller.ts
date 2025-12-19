import { Request, Response } from "express";
import { AudioDurationService } from "../services/audio/audioDuration.service";
import { ResponseHelper } from "../utils/responseHelper";
import { ValidationError } from "../types";
import { getAudioDurationSchema } from "../validations/audioDuration.validations";
import { ZodError } from "zod";

// ==================== HELPER FUNCTIONS ====================

/**
 * Format validation errors from Zod
 */
function formatValidationErrors(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

// ==================== SERVICE INITIALIZATION ====================
const audioDurationService = new AudioDurationService();

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Get audio duration from URL
 * POST /api/audio/duration
 */
export async function getAudioDuration(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = getAudioDurationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const { url } = validationResult.data;

    // Get audio duration
    const durationData = await audioDurationService.getAudioDuration(url);

    return ResponseHelper.success(
      res,
      "Audio duration retrieved successfully",
      durationData
    );
  } catch (error: any) {
    console.error("Error in getAudioDuration:", error);

    // Handle specific error cases
    if (error.message?.includes("Failed to download audio")) {
      return ResponseHelper.badRequest(
        res,
        "Failed to download audio file from the provided URL"
      );
    }

    if (error.message?.includes("Failed to get audio duration")) {
      return ResponseHelper.badRequest(
        res,
        "Failed to extract duration from audio file. Please ensure the URL points to a valid audio file."
      );
    }

    if (error.message?.includes("Could not determine audio duration")) {
      return ResponseHelper.badRequest(
        res,
        "Could not determine audio duration from the file"
      );
    }

    return ResponseHelper.serverError(
      res,
      error.message || "Failed to get audio duration",
      process.env.NODE_ENV === "development" ? error.stack : undefined
    );
  }
}

