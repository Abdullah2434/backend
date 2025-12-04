/**
 * Helper functions for ElevenLabs Voice service
 */

import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import {
  openai,
  ENERGY_DETECTION_MODEL,
  ENERGY_DETECTION_TEMPERATURE,
  ENERGY_DETECTION_MAX_TOKENS,
  API_KEY,
  ELEVENLABS_ADD_VOICE_URL,
  ELEVENLABS_EDIT_VOICE_URL,
  DEFAULT_LANGUAGE,
  DEFAULT_MODEL_ID,
  DEFAULT_ACCENT,
  DEFAULT_LOCALE,
  VALID_ENERGY_LEVELS,
} from "../constants/elevenLabsVoice.constants";
import {
  VoiceForEnergyDetection,
  EnergyDetectionResult,
  ElevenLabsApiVoice,
  VerifiedLanguageEn,
} from "../types/elevenLabsVoice.types";

// ==================== ENERGY DETECTION HELPERS ====================
/**
 * Detect energy level of a voice using OpenAI
 */
export async function detectEnergyLevel(
  voice: VoiceForEnergyDetection
): Promise<EnergyDetectionResult> {
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
      model: ENERGY_DETECTION_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a voice energy classifier. Always return valid JSON only with 'energy' and 'conclusion' fields.",
        },
        { role: "user", content: prompt },
      ],
      temperature: ENERGY_DETECTION_TEMPERATURE,
      max_tokens: ENERGY_DETECTION_MAX_TOKENS,
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

      if (VALID_ENERGY_LEVELS.includes(energy as any)) {
        return {
          energy: energy as "low" | "medium" | "high",
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

// ==================== VOICE PROCESSING HELPERS ====================
/**
 * Extract verified language English from voice data
 */
export function extractVerifiedLanguageEn(
  voice: ElevenLabsApiVoice
): VerifiedLanguageEn | undefined {
  // Find English language - first try verified_languages with eleven_multilingual_v2
  let verifiedLanguageEn = voice.verified_languages?.find(
    (lang) => lang.language === DEFAULT_LANGUAGE && lang.model_id === DEFAULT_MODEL_ID
  );

  // If not found, check if it's an English voice and construct from high_quality_base_model_ids
  if (!verifiedLanguageEn && voice.labels?.language === DEFAULT_LANGUAGE) {
    const highQualityModels = voice.high_quality_base_model_ids || [];

    // Prefer eleven_multilingual_v2, otherwise use first available model
    let selectedModelId: string | undefined = highQualityModels.find(
      (model) => model === DEFAULT_MODEL_ID
    );
    if (!selectedModelId && highQualityModels.length > 0) {
      selectedModelId = highQualityModels[0];
    }

    if (selectedModelId) {
      // Try to find any English entry in verified_languages to get accent/locale/preview_url
      const anyEnglishLang = voice.verified_languages?.find(
        (lang) => lang.language === DEFAULT_LANGUAGE
      );

      verifiedLanguageEn = {
        language: DEFAULT_LANGUAGE,
        model_id: selectedModelId,
        accent: anyEnglishLang?.accent || DEFAULT_ACCENT,
        locale: anyEnglishLang?.locale || DEFAULT_LOCALE,
        preview_url: anyEnglishLang?.preview_url || voice.preview_url,
      };
    }
  }

  return verifiedLanguageEn;
}

/**
 * Parse API response to extract voices array
 */
export function parseVoicesFromResponse(response: any): ElevenLabsApiVoice[] {
  // Handle different response structures
  if (Array.isArray(response.data)) {
    return response.data;
  } else if (response.data?.voices && Array.isArray(response.data.voices)) {
    return response.data.voices;
  } else if (
    response.data?.data?.voices &&
    Array.isArray(response.data.data.voices)
  ) {
    return response.data.data.voices;
  } else {
    throw new Error(
      "API response is not an array. Response structure: " +
        JSON.stringify(response.data).substring(0, 200)
    );
  }
}

/**
 * Build voice data object for database
 */
export function buildVoiceData(
  voice: ElevenLabsApiVoice,
  energyResult: EnergyDetectionResult,
  verifiedLanguageEn?: VerifiedLanguageEn
): any {
  return {
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
    verified_language_en: verifiedLanguageEn || undefined,
  };
}

// ==================== CUSTOM VOICE HELPERS ====================
/**
 * Create FormData for adding voice to ElevenLabs
 */
export function createAddVoiceFormData(
  files: Express.Multer.File[],
  name: string
): FormData {
  const formData = new FormData();
  formData.append("name", name);

  // Append all files to FormData (ElevenLabs API supports multiple files)
  files.forEach((file) => {
    formData.append("files", fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype || "audio/mpeg",
    });
  });

  return formData;
}

/**
 * Create FormData for editing voice in ElevenLabs
 */
export function createEditVoiceFormData(
  name: string,
  description?: string,
  language?: string,
  gender?: string
): FormData {
  const formData = new FormData();
  formData.append("name", name);

  if (description) {
    formData.append("description", description);
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
    formData.append("labels", JSON.stringify(labels));
  }

  return formData;
}

/**
 * Add voice to ElevenLabs API
 */
export async function addVoiceToElevenLabs(
  formData: FormData
): Promise<string> {
  const response = await axios.post(ELEVENLABS_ADD_VOICE_URL, formData, {
    headers: {
      "xi-api-key": API_KEY,
      ...formData.getHeaders(),
    },
  });

  const voiceId = response.data.voice_id;
  if (!voiceId) {
    throw new Error("Failed to get voice_id from ElevenLabs API");
  }

  return voiceId;
}

/**
 * Edit voice in ElevenLabs API
 */
export async function editVoiceInElevenLabs(
  voiceId: string,
  formData: FormData
): Promise<void> {
  await axios.post(
    `${ELEVENLABS_EDIT_VOICE_URL}/${voiceId}/edit`,
    formData,
    {
      headers: {
        "xi-api-key": API_KEY,
        ...formData.getHeaders(),
      },
    }
  );
}

/**
 * Get voice details from ElevenLabs API
 */
export async function getVoiceFromElevenLabs(voiceId: string): Promise<any> {
  const response = await axios.get(
    `${ELEVENLABS_EDIT_VOICE_URL}/${voiceId}`,
    {
      headers: {
        "xi-api-key": API_KEY,
      },
    }
  );

  return response.data;
}

/**
 * Clean up temporary files
 */
export function cleanupTempFiles(files: Express.Multer.File[]): void {
  try {
    files.forEach((file) => {
      fs.unlink(file.path, (err: any) => {
        if (err) console.error(`Error deleting temp file ${file.path}:`, err);
      });
    });
  } catch (cleanupError) {
    console.error("Error during file cleanup:", cleanupError);
  }
}

