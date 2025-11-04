import { Request, Response } from "express";
import { generateSpeech } from "../services/elevenLabsTTS.service";
import ElevenLabsVoice from "../models/elevenLabsVoice";
import { fetchAndSyncElevenLabsVoices } from "../services/elevenLabsVoice.service";

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

    // Return three S3 URLs
    return res.status(200).json({
      success: true,
      data: {
        hook_url: result.hook_url,
        body_url: result.body_url,
        conclusion_url: result.conclusion_url,
        model_id: result.model_id,
        contentType: result.contentType,
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
 */
export async function getVoices(req: Request, res: Response) {
  try {
    const { energyCategory, gender } = req.query;

    // Build filter based on query parameters
    const filter: any = {};

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
      "voice_id name gender description energy preview_url"
    );

    return res.status(200).json({
      success: true,
      data: voices,
      count: voices.length,
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

    const voice = await ElevenLabsVoice.findOne({ voice_id }).select(
      "voice_id preview_url name energy description"
    );

    if (!voice) {
      return res.status(404).json({
        success: false,
        message: "Voice not found",
      });
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
