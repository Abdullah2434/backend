import axios from "axios";
import OpenAI from "openai";
import ElevenLabsVoice from "../models/elevenLabsVoice";
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

    console.log(`📥 Fetched ${voices.length} voices from ElevenLabs API`);

    let savedCount = 0;
    let updatedCount = 0;

    for (const voice of voices) {
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
      `✅ ElevenLabs voices sync complete. Saved: ${savedCount}, Updated: ${updatedCount}`
    );
  } catch (error: any) {
    console.error("❌ Error fetching ElevenLabs voices:", error.message);
    throw error;
  }
}
