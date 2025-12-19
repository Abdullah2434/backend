import { Request, Response } from "express";
import { AudioMergeService } from "../services/audio/audioMerge.service";
import { ResponseHelper } from "../utils/responseHelper";
import { ValidationError } from "../types";
import { mergeAudioFilesSchema } from "../validations/audioMerge.validations";
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
const audioMergeService = new AudioMergeService();

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Merge multiple audio files from URLs
 * POST /api/audio/merge
 */
export async function mergeAudioFiles(req: Request, res: Response) {
  try {
    // Normalize request body - convert object with numeric keys to array if needed
    let normalizedBody = req.body;
    if (req.body?.urls && typeof req.body.urls === "object" && !Array.isArray(req.body.urls)) {
      // Convert object with numeric keys to array
      const urlsObject = req.body.urls;
      const urlsArray = Object.keys(urlsObject)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((key) => urlsObject[key])
        .filter((url) => typeof url === "string");
      normalizedBody = { urls: urlsArray };
    }
    
    // Validate request body
    const validationResult = mergeAudioFilesSchema.safeParse(normalizedBody);
    if (!validationResult.success) {
      console.error("Validation errors:", formatValidationErrors(validationResult.error));
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const { urls } = validationResult.data;

    // Merge audio files and upload to S3
    const mergeResult = await audioMergeService.mergeAudioFilesFromUrls(urls);

    return ResponseHelper.success(
      res,
      "Audio files merged successfully",
      mergeResult
    );
  } catch (error: any) {
    console.error("Error in mergeAudioFiles:", error);

    // Handle specific error cases
    if (error.message?.includes("Failed to download audio")) {
      return ResponseHelper.badRequest(
        res,
        "Failed to download one or more audio files from the provided URLs"
      );
    }

    if (error.message?.includes("Failed to merge audio")) {
      return ResponseHelper.badRequest(
        res,
        "Failed to merge audio files. Please ensure all URLs point to valid audio files."
      );
    }

    if (error.message?.includes("At least one URL is required")) {
      return ResponseHelper.badRequest(res, error.message);
    }

    return ResponseHelper.serverError(
      res,
      error.message || "Failed to merge audio files",
      process.env.NODE_ENV === "development" ? error.stack : undefined
    );
  }
}

