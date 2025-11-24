import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types";
import AuthService from "../modules/auth/services/auth.service";
import { generateSpeech } from "../services/elevenLabsTTS.service";
import ElevenLabsVoice from "../models/elevenLabsVoice";
import {
  fetchAndSyncElevenLabsVoices,
  addCustomVoice,
} from "../services/elevenLabsVoice.service";
import { SubscriptionService } from "../services/subscription.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  validateTextToSpeech,
  validateAddCustomVoice,
  validateGetVoicesQuery,
  validateVoiceIdParam,
} from "../validations/elevenLabs.validations";
import {
  extractAccessToken,
  getUserIdFromRequest,
  buildVoiceFilter,
  validateClonedVoiceAccess,
  extractFilesFromRequest,
} from "../utils/elevenLabsHelpers";
import {
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_LANGUAGE,
} from "../constants/elevenLabs.constants";

// ==================== SERVICE INSTANCES ====================
const authService = new AuthService();

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * Generate text-to-speech audio using ElevenLabs API
 */
export async function textToSpeech(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = validateTextToSpeech(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const {
      voice_id,
      hook,
      body,
      conclusion,
      output_format,
      model_id,
      apply_text_normalization,
      seed,
      pronunciation_dictionary_locators,
    } = validationResult.data!;

    // Fetch voice from database
    const voice = await ElevenLabsVoice.findOne({ voice_id });
    if (!voice) {
      return ResponseHelper.notFound(res, "Voice not found in database");
    }

    // Handle cloned voice authentication
    let voice_settings = null;
    const voiceCategory = voice.category?.toLowerCase().trim();

    if (voiceCategory === "cloned") {
      const accessToken = extractAccessToken(req);
      if (!accessToken) {
        return ResponseHelper.unauthorized(
          res,
          "Authentication required for cloned voices"
        );
      }

      const authResult = await validateClonedVoiceAccess(
        accessToken,
        authService
      );
      if (!authResult) {
        return ResponseHelper.unauthorized(res, "Invalid authentication token");
      }

      voice_settings = authResult.voiceSettings;
    }

    // Generate speech
    const result = await generateSpeech({
      voice_id,
      hook: hook.trim(),
      body: body.trim(),
      conclusion: conclusion.trim(),
      output_format: output_format || DEFAULT_OUTPUT_FORMAT,
      model_id: model_id || undefined,
      voice_settings: voice_settings || undefined,
      apply_text_normalization: apply_text_normalization || "auto",
      seed: seed || undefined,
      pronunciation_dictionary_locators:
        pronunciation_dictionary_locators || undefined,
    });

    return ResponseHelper.success(res, "Speech generated successfully", {
      hook_url: result.hook_url,
      body_url: result.body_url,
      conclusion_url: result.conclusion_url,
      model_id: result.model_id,
    });
  } catch (error: any) {
    console.error("Error in textToSpeech:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to generate speech",
      process.env.NODE_ENV === "development" ? error.stack : undefined
    );
  }
}

/**
 * Get all voices from database (with optional energy and gender filters)
 * Returns: Default voices (no userId) visible to everyone + User's custom/cloned voices (only visible to owner)
 */
export async function getVoices(req: AuthenticatedRequest, res: Response) {
  try {
    // Validate query parameters
    const validationResult = validateGetVoicesQuery(req.query);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    // Get userId from request (optional authentication)
    let userId: string | undefined = getUserIdFromRequest(req);

    if (!userId) {
      const accessToken = extractAccessToken(req);
      if (accessToken) {
        try {
          const user = await authService.getCurrentUser(accessToken);
          if (user) {
            userId = user._id.toString();
          }
        } catch (error) {
          // Invalid token - continue without userId
        }
      }
    }

    // Build filter
    const filter = buildVoiceFilter(userId);
    const { energyCategory, gender } = validationResult.data || {};

    // Add filters if provided
    if (energyCategory) {
      filter.energy = energyCategory;
    }
    if (gender) {
      filter.gender = gender;
    }

    // Fetch voices
    const voices = await ElevenLabsVoice.find(filter).select(
      "voice_id name gender description energy preview_url userId"
    );

    // Add isCustom flag
    const voicesWithCustomFlag = voices.map((voice) => {
      const voiceObj = voice.toObject();
      return {
        ...voiceObj,
        isCustom: !!voiceObj.userId,
      };
    });

    return ResponseHelper.success(res, "Voices retrieved successfully", {
      voices: voicesWithCustomFlag,
      count: voicesWithCustomFlag.length,
    });
  } catch (error: any) {
    console.error("Error in getVoices:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to fetch voices"
    );
  }
}

/**
 * Get voice by voice_id
 * Only returns voice if it's a default voice OR belongs to the requesting user
 */
export async function getVoiceById(req: Request, res: Response) {
  try {
    // Validate route parameters
    const validationResult = validateVoiceIdParam(req.params);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { voice_id } = validationResult.data!;
    const userId = getUserIdFromRequest(req);

    // Fetch voice
    const voice = await ElevenLabsVoice.findOne({ voice_id }).select(
      "voice_id preview_url name energy description userId"
    );

    if (!voice) {
      return ResponseHelper.notFound(res, "Voice not found");
    }

    // Check access permissions for custom voices
    if (voice.userId) {
      if (!userId) {
        return ResponseHelper.unauthorized(
          res,
          "Access denied. This is a custom voice and requires authentication."
        );
      }

      const voiceUserId = voice.userId.toString();
      const requestUserId = String(userId);

      if (voiceUserId !== requestUserId) {
        return ResponseHelper.unauthorized(
          res,
          "Access denied. This voice belongs to another user."
        );
      }
    }

    return ResponseHelper.success(res, "Voice retrieved successfully", {
      voice_id: voice.voice_id,
      preview_url: voice.preview_url,
      name: voice.name,
      energy: voice.energy,
      description: voice.description,
    });
  } catch (error: any) {
    console.error("Error in getVoiceById:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to fetch voice"
    );
  }
}

/**
 * Manually trigger ElevenLabs voices sync
 */
export async function syncVoices(req: Request, res: Response) {
  try {
    // Run sync in background (don't wait for completion)
    fetchAndSyncElevenLabsVoices().catch((error) => {
      console.error("Error in background voices sync:", error);
    });

    return ResponseHelper.success(
      res,
      "ElevenLabs voices sync started successfully"
    );
  } catch (error: any) {
    console.error("Error in syncVoices:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to start voices sync"
    );
  }
}

/**
 * Add custom voice to ElevenLabs and store in database
 * Supports single file or array of files for better voice cloning
 */
export async function addCustomVoiceEndpoint(
  req: AuthenticatedRequest & {
    files?:
      | Express.Multer.File[]
      | { [fieldname: string]: Express.Multer.File[] };
  },
  res: Response
) {
  try {
    // Get user ID
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return ResponseHelper.unauthorized(
        res,
        "Authentication required. User ID not found in request."
      );
    }

    // Validate request body
    const validationResult = validateAddCustomVoice(req.body);
    if (!validationResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        validationResult.errors
      );
    }

    const { name, description, language, gender } = validationResult.data!;

    // Extract and validate files
    const files = extractFilesFromRequest(req);
    if (!files || files.length === 0) {
      return ResponseHelper.badRequest(
        res,
        "At least one audio file is required"
      );
    }

    // Check for active subscription
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getActiveSubscription(
      userId
    );

    if (!subscription) {
      return ResponseHelper.unauthorized(
        res,
        "Active subscription required to create custom voices"
      );
    }

    // Add custom voice
    const voice = await addCustomVoice({
      files,
      name: name.trim(),
      description: description?.trim(),
      language: language || DEFAULT_LANGUAGE,
      gender: gender?.trim(),
      userId,
    });

    return ResponseHelper.created(res, "Custom voice added successfully", {
      voice_id: voice.voice_id,
      name: voice.name,
      description: voice.description,
      gender: voice.gender,
      category: voice.category,
      energy: voice.energy,
      preview_url: voice.preview_url,
    });
  } catch (error: any) {
    console.error("Error in addCustomVoiceEndpoint:", error);
    return ResponseHelper.serverError(
      res,
      error.message || "Failed to add custom voice"
    );
  }
}
