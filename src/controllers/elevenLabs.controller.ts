import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../types";
import AuthService from "../modules/auth/services/auth.service";
import { generateSpeech } from "../services/elevenLabsTTS.service";
import ElevenLabsVoice from "../models/elevenLabsVoice";
import { fetchAndSyncElevenLabsVoices, addCustomVoice } from "../services/elevenLabsVoice.service";

const authService = new AuthService();

/**
 * Generate text-to-speech audio using ElevenLabs API
 */
export async function textToSpeech(req: Request, res: Response) {
  try {
    const { voice_id, hook, body, conclusion, output_format } = req.body;

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

    // Generate speech for hook, body, and conclusion in parallel
    const result = await generateSpeech({
      voice_id,
      hook: hook.trim(),
      body: body.trim(),
      conclusion: conclusion.trim(),
      output_format: output_format || "mp3_44100_128",
    });

    // Return three MP3 URLs directly
    return res.status(200).json({
      success: true,
      data: {
        hook_url: result.hook_url,
        body_url: result.body_url,
        conclusion_url: result.conclusion_url,
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
          console.log("Optional auth: Invalid token, returning default voices only");
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
    const userId = (req as any).user?._id || (req as any).user?.userId || (req as any).user?.id;

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
          message: "Access denied. This is a custom voice and requires authentication.",
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
export async function addCustomVoiceEndpoint(req: AuthenticatedRequest & { file?: Express.Multer.File }, res: Response) {
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
