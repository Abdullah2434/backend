import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../types";
import AuthService from "../modules/auth/services/auth.service";
import { generateSpeech } from "../services/elevenLabsTTS.service";
import ElevenLabsVoice from "../models/elevenLabsVoice";
import UserVideoSettings from "../models/UserVideoSettings";
import {
  fetchAndSyncElevenLabsVoices,
  addCustomVoice,
} from "../services/elevenLabsVoice.service";
import { SubscriptionService } from "../services/subscription.service";
import { ResponseHelper } from "../utils/responseHelper";
import {
  textToSpeechSchema,
  addCustomVoiceSchema,
} from "../validations/elevenLabs.validations";

// ==================== CONSTANTS ====================
const ELEVEN_LABS_MODELS = [
  "eleven_multilingual_v1",
  "eleven_multilingual_v2",
  "eleven_turbo_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2",
  "eleven_flash_v2_5",
  "eleven_english_v1",
  "eleven_english_v2",
] as const;

const MODEL_CHARACTER_LIMITS: Record<string, string> = {
  eleven_multilingual_v1: "10,000 characters",
  eleven_multilingual_v2: "10,000 characters",
  eleven_turbo_v2: "30,000 characters",
  eleven_turbo_v2_5: "40,000 characters",
  eleven_flash_v2: "30,000 characters",
  eleven_flash_v2_5: "40,000 characters",
  eleven_english_v1: "10,000 characters",
  eleven_english_v2: "10,000 characters",
};

const VALID_ENERGY_CATEGORIES = ["low", "medium", "high"] as const;
const VALID_GENDERS = ["male", "female", "unknown"] as const;
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_LANGUAGE = "en";

// Voice preset configurations - optimized for natural speech
// Lower stability = more emotional range and natural variation
// Higher similarity_boost = closer to original voice
// Style controls exaggeration (0 = natural, higher = more dramatic)
// Speed: 0.9-1.1 range for natural pacing
const VOICE_PRESETS = {
   low: {
    stability: 0.70, // Lower for more natural variation
    similarity_boost: 0.80, // Higher for better voice match
    style: 0.0, // Lower for more natural delivery
    use_speaker_boost: true,
    speed: 0.85, // Slightly faster but still natural
  },
  medium: {
    stability: 0.5, // Balanced for natural speech
    similarity_boost: 0.75, // Higher for better voice match
    style: 0.0, // Lower for natural delivery
    use_speaker_boost: true,
    speed: 1.0, // Natural pace
  },
  mid: {
    stability: 0.5, // Balanced for natural speech
    similarity_boost: 0.75, // Higher for better voice match
    style: 0.0, // Lower for natural delivery
    use_speaker_boost: true,
    speed: 1.0, // Natural pace
  },
  high: {
    stability: 0.35, // Slightly higher but still allows variation
    similarity_boost: 0.75, // Higher for better voice match
    style: 0.0, // Very low for most natural delivery
    use_speaker_boost: true,
    speed: 1.1, // Slightly slower for emphasis
  },
} as const;

// ==================== HELPER FUNCTIONS ====================
/**
 * Get voice settings based on preset (case insensitive)
 */
function getVoiceSettingsByPreset(preset: string): {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
} | null {
  const presetLower = preset?.toLowerCase().trim();
  const presetKey = presetLower as keyof typeof VOICE_PRESETS;
  return VOICE_PRESETS[presetKey] || null;
}

/**
 * Extract access token from request headers
 */
function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace("Bearer ", "") || null;
}

/**
 * Get user ID from authenticated request
 */
function getUserIdFromRequest(
  req: AuthenticatedRequest | Request
): string | undefined {
  if ("user" in req && req.user?._id) {
    return req.user._id.toString();
  }
  return (
    (req as any).user?._id || (req as any).user?.userId || (req as any).user?.id
  );
}

/**
 * Build voice filter for database query
 */
function buildVoiceFilter(userId?: string): mongoose.FilterQuery<any> {
  const baseFilter = {
    $or: [{ userId: { $exists: false } }, { userId: null }],
  };

  if (userId) {
    return {
      $or: [...baseFilter.$or, { userId: new mongoose.Types.ObjectId(userId) }],
    };
  }

  return baseFilter;
}

/**
 * Validate and get user for cloned voice access
 */
async function validateClonedVoiceAccess(
  accessToken: string,
  authService: AuthService
): Promise<{ user: any; voiceSettings: any } | null> {
  try {
    const user = await authService.getCurrentUser(accessToken);
    if (!user) {
      return null;
    }

    const userVideoSettings = await UserVideoSettings.findOne({
      userId: user._id,
    });

    let voiceSettings = null;
    if (userVideoSettings?.preset) {
      voiceSettings = getVoiceSettingsByPreset(userVideoSettings.preset);
    }

    return { user, voiceSettings };
  } catch (error) {
    return null;
  }
}

// ==================== CONTROLLER FUNCTIONS ====================
const authService = new AuthService();

/**
 * Generate text-to-speech audio using ElevenLabs API
 */
export async function textToSpeech(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = textToSpeechSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
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
    } = validationResult.data;

    // Validate model_id if provided
    if (model_id && !ELEVEN_LABS_MODELS.includes(model_id as any)) {
      return ResponseHelper.badRequest(
        res,
        `Invalid model_id. Valid models: ${ELEVEN_LABS_MODELS.join(", ")}`,
        {
          valid_models: ELEVEN_LABS_MODELS,
          model_limits: MODEL_CHARACTER_LIMITS,
        }
      );
    }

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
      apply_text_normalization: apply_text_normalization || "auto", // Default to "auto" for better pronunciation
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
    const { energyCategory, gender } = req.query;

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

    // Add energy category filter
    if (energyCategory) {
      if (!VALID_ENERGY_CATEGORIES.includes(energyCategory as any)) {
        return ResponseHelper.badRequest(
          res,
          `Invalid energy category. Must be one of: ${VALID_ENERGY_CATEGORIES.join(
            ", "
          )}`
        );
      }
      filter.energy = energyCategory;
    }

    // Add gender filter
    if (gender) {
      if (!VALID_GENDERS.includes(gender as any)) {
        return ResponseHelper.badRequest(
          res,
          `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`
        );
      }
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
    const { voice_id } = req.params;

    if (!voice_id) {
      return ResponseHelper.badRequest(res, "voice_id is required");
    }

    const userId = getUserIdFromRequest(req);

    const voice = await ElevenLabsVoice.findOne({ voice_id }).select(
      "voice_id preview_url name energy description userId"
    );

    if (!voice) {
      return ResponseHelper.notFound(res, "Voice not found");
    }

    // Check access permissions
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
    // Handle multer's file array type - upload.array() returns File[] or object with fieldname keys
    let files: Express.Multer.File[] | undefined;
    if (req.files) {
      if (Array.isArray(req.files)) {
        // upload.array() returns File[] directly
        files = req.files;
      } else {
        // Fallback: if it's an object with fieldname keys, extract the array
        const fileArray = Object.values(req.files).flat();
        files = fileArray.length > 0 ? fileArray : undefined;
      }
    }
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return ResponseHelper.unauthorized(
        res,
        "Authentication required. User ID not found in request."
      );
    }

    // Validate request body
    const validationResult = addCustomVoiceSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { name, description, language, gender } = validationResult.data;

    // Validate files - support both single file and array
    if (!files || (Array.isArray(files) && files.length === 0)) {
      return ResponseHelper.badRequest(
        res,
        "At least one audio file is required"
      );
    }

    // Ensure files is an array
    const filesArray = Array.isArray(files) ? files : [files];

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
      files: filesArray,
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
