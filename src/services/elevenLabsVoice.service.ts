import axios from "axios";
import OpenAI from "openai";
import mongoose from "mongoose";
import ElevenLabsVoice, { IElevenLabsVoice } from "../models/elevenLabsVoice";
import { connectMongo } from "../config/mongoose";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/voices?show_all=true";
const API_KEY = process.env.ELEVENLABS_API_KEY;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function detectEnergyLevel(voice: {
  name: string;
  category?: string;
  description?: string;
  gender?: string;
  age?: string;
  labels?: { descriptive?: string; use_case?: string };
}): Promise<{ energy: "low" | "medium" | "high"; conclusion: string }> {
  const name = voice.name || "N/A";
  const category = voice.category || "N/A";
  const description = voice.description || "N/A";
  const gender = voice.gender || "N/A";
  const age = voice.age || "N/A";
  const descriptive = voice.labels?.descriptive || "N/A";
  const useCase = voice.labels?.use_case || "N/A";

  const prompt = `You are a voice energy classifier. Analyze and classify energy level.

Voice Details: Name: "${name}", Category: "${category}", Description: "${description}", Gender: "${gender}", Age: "${age}", Descriptive: "${descriptive}", Use Case: "${useCase}"

Classification Rules:
- LOW ENERGY: Calm/soft/deep/soothing/gentle/relaxing. Examples: meditation, narration, ASMR, audiobooks.
- MEDIUM ENERGY: Balanced/conversational/neutral/professional. Examples: business, documentaries, educational.
- HIGH ENERGY: Energetic/powerful/epic/intense/dramatic. Examples: movie trailers, commercials, entertainment TV, action.

Important: Consider all factors. Name often indicates use (e.g., "Epic Movie Trailer" = high energy even if descriptive is "deep"). Use case is strong indicator.

Return JSON: {"energy": "low|medium|high", "conclusion": "Brief explanation mentioning which factors influenced classification (e.g., 'Name contains Epic and use_case is entertainment_tv, indicating high energy despite deep voice descriptor')"}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a voice energy classifier. Always return valid JSON only with 'energy' and 'conclusion' fields.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return {
        energy: "medium",
        conclusion: "No response from OpenAI API",
      };
    }

    try {
      const result = JSON.parse(content);
      const energy = result.energy?.toLowerCase().trim();

      if (energy === "low" || energy === "medium" || energy === "high") {
        return {
          energy,
          conclusion:
            result.conclusion ||
            `Classified as ${energy} based on voice characteristics.`,
        };
      }
      return {
        energy: "medium",
        conclusion: `Invalid energy value: ${energy}. Expected: low, medium, or high`,
      };
    } catch (parseError) {
      // Fallback parsing if JSON parsing fails
      const lower = content.toLowerCase();
      if (lower.includes("high")) {
        return { energy: "high", conclusion: content };
      } else if (lower.includes("low")) {
        return { energy: "low", conclusion: content };
      }
      return {
        energy: "medium",
        conclusion: `Could not parse AI response: ${content}`,
      };
    }
  } catch (error: any) {
    console.error("Error detecting energy level:", error.message);
    return {
      energy: "medium",
      conclusion: `Error during energy detection: ${error.message}`,
    };
  }
}

interface ElevenLabsApiVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: {
    gender?: string;
    age?: string;
    descriptive?: string;
    use_case?: string;
    language?: string;
  };
  preview_url: string;
  high_quality_base_model_ids?: string[];
  verified_languages?: Array<{
    language: string;
    model_id: string;
    accent: string;
    locale: string;
    preview_url: string;
  }>;
}

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

    // Handle different response structures
    let voices: ElevenLabsApiVoice[] = [];
    if (Array.isArray(response.data)) {
      voices = response.data;
    } else if (response.data?.voices && Array.isArray(response.data.voices)) {
      voices = response.data.voices;
    } else if (
      response.data?.data?.voices &&
      Array.isArray(response.data.data.voices)
    ) {
      voices = response.data.data.voices;
    } else {
      console.error(
        "Unexpected API response structure:",
        JSON.stringify(response.data, null, 2)
      );
      throw new Error(
        "API response is not an array. Response structure: " +
          JSON.stringify(response.data).substring(0, 200)
      );
    }

    if (voices.length === 0) {
      console.log("⚠️ No voices found in API response");
      return;
    }

    // Filter out voices with category "cloned" (case-insensitive) - don't add them to DB
    const filteredVoices = voices.filter(
      (voice) => voice.category?.toLowerCase().trim() !== "cloned"
    );

    const clonedCount = voices.length - filteredVoices.length;
    if (clonedCount > 0) {
      console.log(
        `🚫 Ignored ${clonedCount} cloned voices from ElevenLabs API (not adding to DB)`
      );
    }

    if (filteredVoices.length === 0) {
      console.log("⚠️ No voices to sync after filtering out cloned voices");
      return;
    }

    console.log(
      `📥 Fetched ${voices.length} voices from ElevenLabs API, processing ${filteredVoices.length} (excluding cloned)`
    );

    // Get all voice_ids from filtered API response (excluding cloned)
    const apiVoiceIds = new Set(filteredVoices.map((v) => v.voice_id));

    // Find voices in DB that are not in API response (and not cloned - case insensitive)
    // Use $and to combine conditions: voice_id not in API list AND category is not "cloned" (case insensitive)
    const voicesToDelete = await ElevenLabsVoice.find({
      $and: [
        { voice_id: { $nin: Array.from(apiVoiceIds) } },
        { category: { $not: /^cloned$/i } }, // Don't delete cloned voices (case insensitive)
      ],
    });

    let deletedCount = 0;
    if (voicesToDelete.length > 0) {
      const deleteResult = await ElevenLabsVoice.deleteMany({
        $and: [
          { voice_id: { $nin: Array.from(apiVoiceIds) } },
          { category: { $not: /^cloned$/i } }, // Don't delete cloned voices (case insensitive)
        ],
      });
      deletedCount = deleteResult.deletedCount || 0;
      console.log(
        `🗑️ Deleted ${deletedCount} voices that no longer exist in API (excluding cloned voices)`
      );
    }

    let savedCount = 0;
    let updatedCount = 0;

    // Process only filtered voices (excluding cloned)
    for (const voice of filteredVoices) {
      const verifiedLanguageEs = voice.verified_languages?.find(
        (lang) => lang.language === "es"
      );

      // Find English language - first try verified_languages with eleven_multilingual_v2
      let verifiedLanguageEn = voice.verified_languages?.find(
        (lang) =>
          lang.language === "en" && lang.model_id === "eleven_multilingual_v2"
      );

      // If not found, check if it's an English voice and construct from high_quality_base_model_ids
      if (!verifiedLanguageEn && voice.labels?.language === "en") {
        const highQualityModels = voice.high_quality_base_model_ids || [];

        // Prefer eleven_multilingual_v2, otherwise use first available model
        let selectedModelId: string | undefined = highQualityModels.find(
          (model) => model === "eleven_multilingual_v2"
        );
        if (!selectedModelId && highQualityModels.length > 0) {
          selectedModelId = highQualityModels[0];
        }

        if (selectedModelId) {
          // Try to find any English entry in verified_languages to get accent/locale/preview_url
          const anyEnglishLang = voice.verified_languages?.find(
            (lang) => lang.language === "en"
          );

          verifiedLanguageEn = {
            language: "en",
            model_id: selectedModelId,
            accent: anyEnglishLang?.accent || "american",
            locale: anyEnglishLang?.locale || "en-US",
            preview_url: anyEnglishLang?.preview_url || voice.preview_url,
          };
        }
      }

      const energyResult = await detectEnergyLevel({
        name: voice.name,
        category: voice.category,
        description: voice.description,
        gender: voice.labels?.gender,
        age: voice.labels?.age,
        labels: voice.labels,
      });

      const voiceData = {
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        gender: voice.labels?.gender || "unknown",
        age: voice.labels?.age || "unknown",
        preview_url: voice.preview_url,
        description: voice.description || undefined,
        descriptive: voice.labels?.descriptive || undefined,
        use_case: voice.labels?.use_case || undefined,
        energy: energyResult.energy,
        energy_conclusion: energyResult.conclusion,
        verified_language_es: verifiedLanguageEs || undefined,
        verified_language_en: verifiedLanguageEn || undefined,
      };

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
          console.log(`🔄 Updated voice (duplicate handled): ${voice.name}`);
        } else {
          console.error(
            `❌ Error saving voice ${voice.name}:`,
            dbError.message
          );
          throw dbError;
        }
      }
    }

    console.log(
      `✅ ElevenLabs voices sync complete. Saved: ${savedCount}, Updated: ${updatedCount}, Deleted: ${deletedCount}`
    );
  } catch (error: any) {
    console.error("❌ Error fetching ElevenLabs voices:", error.message);
    throw error;
  }
}

/**
 * Add custom voice to ElevenLabs and store in database
 * Flow:
 * 1. POST /v1/voices/add - Add voice with file and name
 * 2. PATCH /v1/voices/{voice_id}/edit - Edit voice with description and labels
 * 3. GET /v1/voices/{voice_id} - Get full voice details
 * 4. Store in database with userId
 */
export async function addCustomVoice(params: {
  file: Express.Multer.File;
  name: string;
  description?: string;
  language?: string;
  gender?: string;
  userId: string;
}): Promise<IElevenLabsVoice> {
  try {
    if (!API_KEY) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required");
    }

    const { file, name, description, language = "en", gender, userId } = params;

    // Step 1: Add voice to ElevenLabs
    console.log(`📤 Step 1: Adding voice to ElevenLabs with name: ${name}`);
    const FormData = require("form-data");
    const fs = require("fs");
    const formData = new FormData();
    formData.append("name", name);
    formData.append("files", fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype || "audio/mpeg",
    });

    const addResponse = await axios.post(
      "https://api.elevenlabs.io/v1/voices/add",
      formData,
      {
        headers: {
          "xi-api-key": API_KEY,
          ...formData.getHeaders(),
        },
      }
    );

    const voiceId = addResponse.data.voice_id;
    if (!voiceId) {
      throw new Error("Failed to get voice_id from ElevenLabs API");
    }

    console.log(`✅ Step 1 complete: Voice created with ID: ${voiceId}`);

    // Step 2: Edit voice with description and labels
    console.log(`📤 Step 2: Editing voice ${voiceId} with description and labels`);
    const editFormData = new FormData();
    editFormData.append("name", name);
    if (description) {
      editFormData.append("description", description);
    }
    
    // Build labels JSON
    const labels: any = {};
    if (language) {
      labels.language = language;
    }
    if (gender) {
      labels.gender = gender;
    }
    
    if (Object.keys(labels).length > 0) {
      editFormData.append("labels", JSON.stringify(labels));
    }

    await axios.post(
      `https://api.elevenlabs.io/v1/voices/${voiceId}/edit`,
      editFormData,
      {
        headers: {
          "xi-api-key": API_KEY,
          ...editFormData.getHeaders(),
        },
      }
    );

    console.log(`✅ Step 2 complete: Voice edited with description and labels`);

    // Step 3: Get full voice details
    console.log(`📤 Step 3: Fetching full voice details for ${voiceId}`);
    const getResponse = await axios.get(
      `https://api.elevenlabs.io/v1/voices/${voiceId}`,
      {
        headers: {
          "xi-api-key": API_KEY,
        },
      }
    );

    const voiceData = getResponse.data;
    console.log(`✅ Step 3 complete: Got voice details`);

    // Step 4: Store in database with userId
    console.log(`📤 Step 4: Storing voice in database for user ${userId}`);
    
    // Extract verified languages from voice data
    const verified_language_en = voiceData.verified_language_en
      ? {
          language: voiceData.verified_language_en.language || "en",
          model_id: voiceData.verified_language_en.model_id || "eleven_multilingual_v2",
          accent: voiceData.verified_language_en.accent || "",
          locale: voiceData.verified_language_en.locale || "",
          preview_url: voiceData.verified_language_en.preview_url || "",
        }
      : undefined;

    const verified_language_es = voiceData.verified_language_es
      ? {
          language: voiceData.verified_language_es.language || "es",
          model_id: voiceData.verified_language_es.model_id || "eleven_multilingual_v2",
          accent: voiceData.verified_language_es.accent || "",
          locale: voiceData.verified_language_es.locale || "",
          preview_url: voiceData.verified_language_es.preview_url || "",
        }
      : undefined;

    // Detect energy level using existing function
    const energyResult = await detectEnergyLevel({
      name: voiceData.name,
      category: voiceData.category,
      description: voiceData.description,
      gender: voiceData.labels?.gender || gender || "unknown",
      age: voiceData.labels?.age || "unknown",
      labels: {
        descriptive: voiceData.labels?.descriptive,
        use_case: voiceData.labels?.use_case,
      },
    });

    // Create voice record
    const voiceRecord = {
      voice_id: voiceId,
      name: voiceData.name,
      category: voiceData.category || "custom",
      gender: voiceData.labels?.gender || gender || "unknown",
      age: voiceData.labels?.age || "unknown",
      preview_url: voiceData.preview_url || "",
      description: voiceData.description || description || undefined,
      descriptive: voiceData.labels?.descriptive || undefined,
      use_case: voiceData.labels?.use_case || undefined,
      energy: energyResult.energy,
      energy_conclusion: energyResult.conclusion,
      verified_language_en,
      verified_language_es,
      userId: new mongoose.Types.ObjectId(userId),
    };

    // Save or update voice in database
    const existingVoice = await ElevenLabsVoice.findOne({ voice_id: voiceId });
    let savedVoice: IElevenLabsVoice;

    if (existingVoice) {
      await ElevenLabsVoice.updateOne({ voice_id: voiceId }, { $set: voiceRecord });
      savedVoice = await ElevenLabsVoice.findOne({ voice_id: voiceId }) as IElevenLabsVoice;
      console.log(`🔄 Updated existing voice: ${voiceId}`);
    } else {
      savedVoice = await ElevenLabsVoice.create(voiceRecord);
      console.log(`✅ Created new voice: ${voiceId}`);
    }

    // Clean up temporary file
    try {
      fs.unlink(file.path, (err: any) => {
        if (err) console.error("Error deleting temp file:", err);
      });
    } catch (cleanupError) {
      console.warn("Failed to cleanup temp file:", cleanupError);
    }

    console.log(`✅ Step 4 complete: Voice stored in database`);
    return savedVoice;
  } catch (error: any) {
    console.error("❌ Error adding custom voice:", error.message);
    if (error.response) {
      console.error("ElevenLabs API error:", error.response.data);
      throw new Error(
        `ElevenLabs API error: ${error.response.data?.detail?.message || error.message}`
      );
    }
    throw error;
  }
}
