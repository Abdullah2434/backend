import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest, ValidationError } from "../types";
import AuthService from "../services/auth.service";
import { generateSpeech } from "../services/elevenLabs";
import ElevenLabsVoice from "../models/elevenLabsVoice";
import UserVideoSettings from "../models/UserVideoSettings";
import {
  fetchAndSyncElevenLabsVoices,
  addCustomVoice,
} from "../services/elevenLabs";
import { SubscriptionService } from "../services/payment";
import { ResponseHelper } from "../utils/responseHelper";
import {
  textToSpeechSchema,
  addCustomVoiceSchema,
} from "../validations/elevenLabs.validations";
import { ZodError } from "zod";
import {
  VoiceSettings,
  ClonedVoiceAccessResult,
  EnergyCategory,
  Gender,
  VoiceResponse,
  VoiceDetailsResponse,
} from "../types/elevenLabs.types";
import {
  ELEVEN_LABS_MODELS,
  MODEL_CHARACTER_LIMITS,
  VALID_ENERGY_CATEGORIES,
  VALID_GENDERS,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_LANGUAGE,
} from "../constants/elevenLabs.constants";
import { VOICE_ENERGY_PRESETS } from "../constants/voiceEnergy";

// ==================== CONSTANTS ====================
const VOICE_CATEGORY_CLONED = "cloned";

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

/**
 * Get voice settings based on preset (case insensitive)
 */
function getVoiceSettingsByPreset(preset: string): VoiceSettings | null {
  const presetLower = preset?.toLowerCase().trim();
  const presetKey = presetLower as keyof typeof VOICE_ENERGY_PRESETS;
  const presetConfig = VOICE_ENERGY_PRESETS[presetKey];

  if (!presetConfig) return null;

  return {
    stability: presetConfig.stability,
    similarity_boost: presetConfig.similarity_boost,
    style: presetConfig.style,
    use_speaker_boost: presetConfig.use_speaker_boost,
    speed: presetConfig.speed,
  };
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
 * Get userId from token if not already in request
 */
async function getUserIdFromToken(
  req: Request,
  authService: AuthService
): Promise<string | undefined> {
  const accessToken = extractAccessToken(req);
  if (!accessToken) return undefined;

  try {
    const user = await authService.getCurrentUser(accessToken);
    return user?._id?.toString();
  } catch (error) {
    return undefined;
  }
}

/**
 * Build voice filter for database query
 */
function buildVoiceFilter(userId?: string): mongoose.FilterQuery<any> {
  const baseFilter = {
    $or: [{ userId: { $exists: false } }, { userId: null }],
  };

  if (!userId) return baseFilter;

  return {
    $or: [...baseFilter.$or, { userId: new mongoose.Types.ObjectId(userId) }],
  };
}

/**
 * Validate and get user for cloned voice access
 */
async function validateClonedVoiceAccess(
  accessToken: string,
  authService: AuthService
): Promise<ClonedVoiceAccessResult | null> {
  try {
    const user = await authService.getCurrentUser(accessToken);
    if (!user) return null;

    const userVideoSettings = await UserVideoSettings.findOne({
      userId: user._id,
    });

    const voiceSettings = userVideoSettings?.preset
      ? getVoiceSettingsByPreset(userVideoSettings.preset)
      : null;

    return { user, voiceSettings };
  } catch (error) {
    return null;
  }
}

/**
 * Validate model ID
 */
function isValidModelId(modelId: string): boolean {
  return ELEVEN_LABS_MODELS.includes(modelId as any);
}

/**
 * Check if voice category is cloned
 */
function isClonedVoice(category: string | undefined): boolean {
  return category?.toLowerCase().trim() === VOICE_CATEGORY_CLONED;
}

/**
 * Validate and apply energy category filter
 */
function validateAndApplyEnergyFilter(
  filter: mongoose.FilterQuery<any>,
  energyCategory: unknown
): boolean {
  if (!energyCategory) return true;

  if (!VALID_ENERGY_CATEGORIES.includes(energyCategory as any)) {
    return false;
  }

  filter.energy = energyCategory;
  return true;
}

/**
 * Validate and apply gender filter
 */
function validateAndApplyGenderFilter(
  filter: mongoose.FilterQuery<any>,
  gender: unknown
): boolean {
  if (!gender) return true;

  if (!VALID_GENDERS.includes(gender as any)) {
    return false;
  }

  filter.gender = gender;
  return true;
}

/**
 * Check if user has access to a custom voice
 */
function hasVoiceAccess(
  voiceUserId: string | undefined,
  requestUserId: string | undefined
): boolean {
  // Default voices are accessible to everyone
  if (!voiceUserId) return true;

  // Custom voices require authentication
  if (!requestUserId) return false;

  return voiceUserId === requestUserId;
}

/**
 * Get access denied message based on authentication status
 */
function getAccessDeniedMessage(userId: string | undefined): string {
  return userId
    ? "Access denied. This voice belongs to another user."
    : "Access denied. This is a custom voice and requires authentication.";
}

/**
 * Handle multer's file array type
 */
function extractFilesFromRequest(
  files:
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined
): Express.Multer.File[] | undefined {
  if (!files) return undefined;

  if (Array.isArray(files)) return files;

  const fileArray = Object.values(files).flat();
  return fileArray.length > 0 ? fileArray : undefined;
}

/**
 * Transform voices to include isCustom flag
 */
function transformVoicesWithCustomFlag(voices: any[]): VoiceResponse[] {
  return voices.map((voice) => {
    const voiceObj = voice.toObject();
    return {
      ...voiceObj,
      isCustom: !!voiceObj.userId,
    };
  });
}

/**
 * Get voice settings for cloned voice
 */
async function getVoiceSettingsForClonedVoice(
  req: Request,
  authService: AuthService
): Promise<VoiceSettings | null> {
  const accessToken = extractAccessToken(req);
  if (!accessToken) return null;

  const authResult = await validateClonedVoiceAccess(accessToken, authService);
  return authResult?.voiceSettings || null;
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
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const {
      voice_id,
      text,
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
    if (model_id && !isValidModelId(model_id)) {
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

    // No authentication required - use default voice settings for cloned voices if needed
    let voice_settings: VoiceSettings | null = null;
    // Optional: If you want to use default preset settings for cloned voices, uncomment below
    // if (isClonedVoice(voice.category)) {
    //   voice_settings = getVoiceSettingsByPreset("professional") || null;
    // }

    // Generate speech
    const speechOptions: any = {
      voice_id,
      output_format: output_format || DEFAULT_OUTPUT_FORMAT,
      model_id: model_id || undefined,
      voice_settings: voice_settings || undefined,
      apply_text_normalization: apply_text_normalization || "auto",
      seed: seed || undefined,
      pronunciation_dictionary_locators:
        pronunciation_dictionary_locators || undefined,
    };

    // Handle single text field OR hook/body/conclusion
    if (text) {
      speechOptions.text = text.trim();
    } else {
      speechOptions.hook = hook!.trim();
      speechOptions.body = body!.trim();
      speechOptions.conclusion = conclusion!.trim();
    }

    const result = await generateSpeech(speechOptions);

    // Return appropriate response based on input format
    if (text) {
      return ResponseHelper.success(res, "Speech generated successfully", {
        text_url: result.text_url,
        model_id: result.model_id,
      });
    } else {
      return ResponseHelper.success(res, "Speech generated successfully", {
        hook_url: result.hook_url,
        body_url: result.body_url,
        conclusion_url: result.conclusion_url,
        model_id: result.model_id,
      });
    }
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

    // Get userId from request or token
    let userId =
      getUserIdFromRequest(req) || (await getUserIdFromToken(req, authService));

    // Build filter
    const filter = buildVoiceFilter(userId);

    // Validate and apply energy category filter
    if (
      energyCategory &&
      !validateAndApplyEnergyFilter(filter, energyCategory)
    ) {
      return ResponseHelper.badRequest(
        res,
        `Invalid energy category. Must be one of: ${VALID_ENERGY_CATEGORIES.join(
          ", "
        )}`
      );
    }

    // Validate and apply gender filter
    if (gender && !validateAndApplyGenderFilter(filter, gender)) {
      return ResponseHelper.badRequest(
        res,
        `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`
      );
    }

    // Fetch voices
    const voices = await ElevenLabsVoice.find(filter).select(
      "voice_id name gender description energy preview_url userId"
    );

    // Transform voices with isCustom flag
    const voicesWithCustomFlag = transformVoicesWithCustomFlag(voices);

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
    const voiceUserId = voice.userId?.toString();
    if (!hasVoiceAccess(voiceUserId, userId)) {
      return ResponseHelper.unauthorized(res, getAccessDeniedMessage(userId));
    }

    const response: VoiceDetailsResponse = {
      voice_id: voice.voice_id,
      preview_url: voice.preview_url,
      name: voice.name,
      energy: voice.energy,
      description: voice.description,
    };

    return ResponseHelper.success(
      res,
      "Voice retrieved successfully",
      response
    );
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
      return ResponseHelper.badRequest(
        res,
        "Validation failed",
        formatValidationErrors(validationResult.error)
      );
    }

    const { name, description, language, gender } = validationResult.data;

    // Validate files
    const files = extractFilesFromRequest(req.files);
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
