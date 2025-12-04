import axios from "axios";
import mongoose from "mongoose";
import ElevenLabsVoice, {
  IElevenLabsVoice,
} from "../../models/elevenLabsVoice";
import { connectMongo } from "../../config/mongoose";
import {
  ELEVENLABS_API_URL,
  API_KEY,
  DEFAULT_LANGUAGE,
  DEFAULT_CATEGORY,
  DEFAULT_GENDER,
  DEFAULT_AGE,
  DEFAULT_MODEL_ID,
  CLONED_CATEGORY,
} from "../../constants/elevenLabsVoice.constants";
import {
  ElevenLabsApiVoice,
  AddCustomVoiceParams,
} from "../../types/elevenLabsVoice.types";
import {
  detectEnergyLevel,
  parseVoicesFromResponse,
  extractVerifiedLanguageEn,
  buildVoiceData,
  addVoiceToElevenLabs,
  createAddVoiceFormData,
  createEditVoiceFormData,
  editVoiceInElevenLabs,
  getVoiceFromElevenLabs,
  cleanupTempFiles,
} from "../../utils/elevenLabsVoiceHelpers";

// Re-export types for backward compatibility
export type { ElevenLabsApiVoice, AddCustomVoiceParams };

export async function fetchAndSyncElevenLabsVoices(): Promise<void> {
  try {
    if (!API_KEY) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required");
    }

    await connectMongo();

    const response = await axios.get<any>(ELEVENLABS_API_URL, {
      headers: {
        "xi-api-key": API_KEY,
      },
    });

    // Parse voices from response using helper function
    const voices = parseVoicesFromResponse(response);

    if (voices.length === 0) {
      return;
    }

    // Filter out voices with category "cloned" (case-insensitive) - don't add them to DB
    const filteredVoices = voices.filter(
      (voice) => voice.category?.toLowerCase().trim() !== CLONED_CATEGORY
    );

    const clonedCount = voices.length - filteredVoices.length;
    if (clonedCount > 0) {
    }

    if (filteredVoices.length === 0) {
      return;
    }

    // Get all voice_ids from filtered API response (excluding cloned)
    const apiVoiceIds = new Set(filteredVoices.map((v) => v.voice_id));

    // Find voices in DB that are not in API response (and not cloned - case insensitive)
    // Use $and to combine conditions: voice_id not in API list AND category is not "cloned" (case insensitive)
    const deleteQuery = {
      $and: [
        { voice_id: { $nin: Array.from(apiVoiceIds) } },
        { category: { $not: new RegExp(`^${CLONED_CATEGORY}$`, "i") } }, // Don't delete cloned voices (case insensitive)
      ],
    };

    const voicesToDelete = await ElevenLabsVoice.find(deleteQuery);

    let deletedCount = 0;
    if (voicesToDelete.length > 0) {
      const deleteResult = await ElevenLabsVoice.deleteMany(deleteQuery);
      deletedCount = deleteResult.deletedCount || 0;
    }

    let savedCount = 0;
    let updatedCount = 0;

    // Process only filtered voices (excluding cloned)
    for (const voice of filteredVoices) {
      // Extract verified language English using helper function
      const verifiedLanguageEn = extractVerifiedLanguageEn(voice);

      // Detect energy level using helper function
      const energyResult = await detectEnergyLevel({
        name: voice.name,
        category: voice.category,
        description: voice.description,
        gender: voice.labels?.gender,
        age: voice.labels?.age,
        labels: voice.labels,
      });

      // Build voice data using helper function
      const voiceData = buildVoiceData(voice, energyResult, verifiedLanguageEn);

      try {
        const existingVoice = await ElevenLabsVoice.findOne({
          voice_id: voice.voice_id,
        });

        if (existingVoice) {
          await ElevenLabsVoice.updateOne(
            { voice_id: voice.voice_id },
            { $set: voiceData }
          );
          updatedCount++;
        } else {
          await ElevenLabsVoice.create(voiceData);
          savedCount++;
        }
      } catch (dbError: any) {
        // Handle duplicate key error by updating instead
        if (dbError.code === 11000) {
          await ElevenLabsVoice.updateOne(
            { voice_id: voice.voice_id },
            { $set: voiceData }
          );
          updatedCount++;
        } else {
          throw dbError;
        }
      }
    }
  } catch (error: any) {
    throw error;
  }
}

/**
 * Add custom voice to ElevenLabs and store in database
 * Flow:
 * 1. POST /v1/voices/add - Add voice with file(s) and name
 * 2. PATCH /v1/voices/{voice_id}/edit - Edit voice with description and labels
 * 3. GET /v1/voices/{voice_id} - Get full voice details
 * 4. Store in database with userId
 *
 * Supports multiple audio files for better voice cloning quality
 */
export async function addCustomVoice(
  params: AddCustomVoiceParams
): Promise<IElevenLabsVoice> {
  try {
    if (!API_KEY) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required");
    }

    const {
      files,
      name,
      description,
      language = DEFAULT_LANGUAGE,
      gender,
      userId,
    } = params;

    if (!files || files.length === 0) {
      throw new Error("At least one audio file is required");
    }

    // Create FormData and add voice to ElevenLabs using helper functions
    const addFormData = createAddVoiceFormData(files, name);
    const voiceId = await addVoiceToElevenLabs(addFormData);

    // Edit voice with description and labels using helper functions
    const editFormData = createEditVoiceFormData(
      name,
      description,
      language,
      gender
    );
    await editVoiceInElevenLabs(voiceId, editFormData);

    // Get full voice details from ElevenLabs using helper function
    const voiceData = await getVoiceFromElevenLabs(voiceId);

    // Extract verified languages from voice data (only English)
    const verified_language_en = voiceData.verified_language_en
      ? {
          language: voiceData.verified_language_en.language || DEFAULT_LANGUAGE,
          model_id: voiceData.verified_language_en.model_id || DEFAULT_MODEL_ID,
          accent: voiceData.verified_language_en.accent || "",
          locale: voiceData.verified_language_en.locale || "",
          preview_url: voiceData.verified_language_en.preview_url || "",
        }
      : undefined;

    // Detect energy level using helper function
    const energyResult = await detectEnergyLevel({
      name: voiceData.name,
      category: voiceData.category,
      description: voiceData.description,
      gender: voiceData.labels?.gender || gender || DEFAULT_GENDER,
      age: voiceData.labels?.age || DEFAULT_AGE,
      labels: {
        descriptive: voiceData.labels?.descriptive,
        use_case: voiceData.labels?.use_case,
      },
    });

    // Create voice record
    const voiceRecord = {
      voice_id: voiceId,
      name: voiceData.name,
      category: voiceData.category || DEFAULT_CATEGORY,
      gender: voiceData.labels?.gender || gender || DEFAULT_GENDER,
      age: voiceData.labels?.age || DEFAULT_AGE,
      preview_url: voiceData.preview_url || "",
      description: voiceData.description || description || undefined,
      descriptive: voiceData.labels?.descriptive || undefined,
      use_case: voiceData.labels?.use_case || undefined,
      energy: energyResult.energy,
      energy_conclusion: energyResult.conclusion,
      verified_language_en,
      userId: new mongoose.Types.ObjectId(userId),
    };

    // Save or update voice in database
    const existingVoice = await ElevenLabsVoice.findOne({ voice_id: voiceId });
    let savedVoice: IElevenLabsVoice;

    if (existingVoice) {
      await ElevenLabsVoice.updateOne(
        { voice_id: voiceId },
        { $set: voiceRecord }
      );
      savedVoice = (await ElevenLabsVoice.findOne({
        voice_id: voiceId,
      })) as IElevenLabsVoice;
    } else {
      savedVoice = await ElevenLabsVoice.create(voiceRecord);
    }

    // Clean up temporary files using helper function
    cleanupTempFiles(files);

    return savedVoice;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `ElevenLabs API error: ${
          error.response.data?.detail?.message || error.message
        }`
      );
    }
    throw error;
  }
}
