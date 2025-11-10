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

const authService = new AuthService();

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
  
  if (presetLower === "low") {
    return {
      stability: 0.3,
      similarity_boost: 0.75,
      style: 0.6,
      use_speaker_boost: true,
      speed: 1.15,
    };
  } else if (presetLower === "medium" || presetLower === "mid") {
    return {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.4,
      use_speaker_boost: true,
      speed: 1.0,
    };
  } else if (presetLower === "high") {
    return {
      stability: 0.7,
      similarity_boost: 0.75,
      style: 0.2,
      use_speaker_boost: true,
      speed: 0.9,
    };
  }
  
  return null;
}

/**
 * Generate text-to-speech audio using ElevenLabs API
 */
export async function textToSpeech(req: Request, res: Response) {
  try {
    const { voice_id, hook, body, conclusion, output_format, model_id } =
      req.body;

    // Validate required fields
    if (!voice_id) {
      return res.status(400).json({
        success: false,
        message: "voice_id is required",
      });
    }

    if (!hook || typeof hook !== "string" || hook.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "hook is required and must be a non-empty string",
      });
    }

    if (!body || typeof body !== "string" || body.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "body is required and must be a non-empty string",
      });
    }

    if (
      !conclusion ||
      typeof conclusion !== "string" ||
      conclusion.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "conclusion is required and must be a non-empty string",
      });
    }

    // Validate model_id if provided
    const validModels = [
      "eleven_multilingual_v1",
      "eleven_multilingual_v2",
      "eleven_turbo_v2",
      "eleven_turbo_v2_5",
      "eleven_flash_v2",
      "eleven_flash_v2_5",
      "eleven_english_v1",
      "eleven_english_v2",
    ];

    if (model_id && !validModels.includes(model_id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid model_id. Valid models: ${validModels.join(", ")}`,
        valid_models: validModels,
        model_limits: {
          eleven_multilingual_v1: "10,000 characters",
          eleven_multilingual_v2: "10,000 characters",
          eleven_turbo_v2: "30,000 characters",
          eleven_turbo_v2_5: "40,000 characters",
          eleven_flash_v2: "30,000 characters",
          eleven_flash_v2_5: "40,000 characters",
          eleven_english_v1: "10,000 characters",
          eleven_english_v2: "10,000 characters",
        },
      });
    }

    // Fetch voice from database to check category
    const voice = await ElevenLabsVoice.findOne({ voice_id });
    if (!voice) {
      return res.status(404).json({
        success: false,
        message: "Voice not found in database",
      });
    }

    // Check if voice category is "cloned" (case insensitive)
    let voice_settings = null;
    const voiceCategory = voice.category?.toLowerCase().trim();
    
    if (voiceCategory === "cloned") {
      // Get user from auth token
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.replace("Bearer ", "");
      
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          message: "Authentication required for cloned voices",
        });
      }

      try {
        const user = await authService.getCurrentUser(accessToken);
        if (!user) {
          return res.status(401).json({
            success: false,
            message: "Invalid authentication token",
          });
        }

        // Get user video settings
        const userVideoSettings = await UserVideoSettings.findOne({
          userId: user._id,
        });

        if (userVideoSettings) {
          // Get preset from preset field only (case insensitive)
          const preset = userVideoSettings.preset;
          
          if (preset) {
            voice_settings = getVoiceSettingsByPreset(preset);
            if (voice_settings) {
              console.log(`🎯 Using voice settings for preset: ${preset}`, voice_settings);
            } else {
              console.log(`⚠️ Invalid preset value: ${preset}. Valid values: low, medium, high`);
            }
          } else {
            console.log(`⚠️ No preset found in user video settings for user ${user._id}`);
          }
        } else {
          console.log(`⚠️ No user video settings found for user ${user._id}`);
        }
      } catch (error: any) {
        console.error("Error getting user or video settings:", error);
        return res.status(401).json({
          success: false,
          message: "Failed to authenticate user",
        });
      }
    }

    // Generate speech for hook, body, and conclusion in parallel
    const result = await generateSpeech({
      voice_id,
      hook: hook.trim(),
      body: body.trim(),
      conclusion: conclusion.trim(),
      output_format: output_format || "mp3_44100_128",
      model_id: model_id || undefined, // Pass model_id if provided
      voice_settings: voice_settings || undefined, // Pass voice_settings if available
    });

    // Return three MP3 URLs directly
    return res.status(200).json({
      success: true,
      data: {
        hook_url: result.hook_url,
        body_url: result.body_url,
        conclusion_url: result.conclusion_url,
        model_id: result.model_id, // Include the model that was used
      },
    });
  } catch (error: any) {
    console.error("Error in textToSpeech:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate speech",
    });
  }
}

/**
 * Get all voices from database (with optional energy and gender filters)
 * Returns: Default voices (no userId) visible to everyone + User's custom/cloned voices (only visible to owner)
 * Works with or without authentication - if authenticated, includes user's custom voices
 */
export async function getVoices(req: AuthenticatedRequest, res: Response) {
  try {
    const { energyCategory, gender } = req.query;

    // Get userId from request (optional authentication)
    // Try to extract user from token if provided
    let userId: string | undefined = req.user?._id;

    if (!userId) {
      // If not set by middleware, try to extract from token manually
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.replace("Bearer ", "");

      if (accessToken) {
        try {
          const user = await authService.getCurrentUser(accessToken);
          if (user) {
            userId = user._id.toString();
          }
        } catch (error) {
          // Invalid token - continue without userId (will only return default voices)
          console.log(
            "Optional auth: Invalid token, returning default voices only"
          );
        }
      }
    }

    // Build filter based on query parameters
    const filter: any = {};

    // Filter voices:
    // - Default voices (no userId or userId is null) -> visible to everyone
    // - Custom/cloned voices (with userId) -> only visible to the user who created them
    if (userId) {
      filter.$or = [
        { userId: { $exists: false } }, // Default voices (no userId field)
        { userId: null }, // Default voices (userId is null)
        { userId: new mongoose.Types.ObjectId(userId) }, // User's custom/cloned voices
      ];
    } else {
      // If not authenticated, only return default voices
      filter.$or = [
        { userId: { $exists: false } }, // Default voices (no userId field)
        { userId: null }, // Default voices (userId is null)
      ];
    }

    if (energyCategory) {
      const validEnergy = ["low", "medium", "high"];
      if (!validEnergy.includes(energyCategory as string)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid energy category. Must be 'low', 'medium', or 'high'",
        });
      }
      filter.energy = energyCategory;
    }

    if (gender) {
      const validGenders = ["male", "female", "unknown"];
      if (!validGenders.includes(gender as string)) {
        return res.status(400).json({
          success: false,
          message: "Invalid gender. Must be 'male', 'female', or 'unknown'",
        });
      }
      filter.gender = gender;
    }

    const voices = await ElevenLabsVoice.find(filter).select(
      "voice_id name gender description energy preview_url userId"
    );

    // Add isCustom flag to indicate if voice is cloned/custom (has userId)
    const voicesWithCustomFlag = voices.map((voice) => {
      const voiceObj = voice.toObject();
      return {
        ...voiceObj,
        isCustom: !!voiceObj.userId, // true if userId exists (cloned/custom voice)
      };
    });

    return res.status(200).json({
      success: true,
      data: voicesWithCustomFlag,
      count: voicesWithCustomFlag.length,
    });
  } catch (error: any) {
    console.error("Error fetching voices:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch voices",
    });
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
      return res.status(400).json({
        success: false,
        message: "voice_id is required",
      });
    }

    // Get userId from request (if authenticated)
    const userId =
      (req as any).user?._id ||
      (req as any).user?.userId ||
      (req as any).user?.id;

    const voice = await ElevenLabsVoice.findOne({ voice_id }).select(
      "voice_id preview_url name energy description userId"
    );

    if (!voice) {
      return res.status(404).json({
        success: false,
        message: "Voice not found",
      });
    }

    // Check if voice is accessible:
    // - Default voice (no userId) -> accessible to everyone
    // - Custom voice (has userId) -> only accessible to owner
    if (voice.userId) {
      if (!userId) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. This is a custom voice and requires authentication.",
        });
      }

      // Check if userId matches
      const voiceUserId = voice.userId.toString();
      const requestUserId = String(userId);

      if (voiceUserId !== requestUserId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. This voice belongs to another user.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        voice_id: voice.voice_id,
        preview_url: voice.preview_url,
        name: voice.name,
        energy: voice.energy,
        description: voice.description,
      },
    });
  } catch (error: any) {
    console.error("Error fetching voice by ID:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch voice",
    });
  }
}

/**
 * Manually trigger ElevenLabs voices sync
 */
export async function syncVoices(req: Request, res: Response) {
  try {
    console.log("🔄 Manual ElevenLabs voices sync triggered via API");

    // Run sync in background (don't wait for completion)
    fetchAndSyncElevenLabsVoices().catch((error: any) => {
      console.error("❌ ElevenLabs voices sync failed:", error);
    });

    return res.status(200).json({
      success: true,
      message: "ElevenLabs voices sync started successfully",
    });
  } catch (error: any) {
    console.error("Error starting voices sync:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to start voices sync",
    });
  }
}

/**
 * Add custom voice to ElevenLabs and store in database
 * Flow:
 * 1. POST /v1/voices/add - Add voice with file and name
 * 2. POST /v1/voices/{voice_id}/edit - Edit voice with description and labels
 * 3. GET /v1/voices/{voice_id} - Get full voice details
 * 4. Store in database with userId
 */
export async function addCustomVoiceEndpoint(
  req: AuthenticatedRequest & { file?: Express.Multer.File },
  res: Response
) {
  try {
    const file = req.file;
    const { name, description, language, gender } = req.body;

    // Get userId from request (from auth token - req.user._id)
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. User ID not found in request.",
      });
    }

    // Check for active subscription
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getActiveSubscription(
      userId.toString()
    );
    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to create custom voices",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required",
      });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must be a non-empty string",
      });
    }

    // Call service to add custom voice
    const voice = await addCustomVoice({
      file,
      name: name.trim(),
      description: description?.trim(),
      language: language || "en",
      gender: gender?.trim(),
      userId: String(userId),
    });

    return res.status(201).json({
      success: true,
      message: "Custom voice added successfully",
      data: {
        voice_id: voice.voice_id,
        name: voice.name,
        description: voice.description,
        gender: voice.gender,
        category: voice.category,
        energy: voice.energy,
        preview_url: voice.preview_url,
      },
    });
  } catch (error: any) {
    console.error("Error adding custom voice:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add custom voice",
    });
  }
}
