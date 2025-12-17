import ElevenLabsVoice from "../../models/elevenLabsVoice";
import {
  API_KEY,
  DEFAULT_OUTPUT_FORMAT,
} from "../../constants/elevenLabsTTS.constants";
import {
  TextToSpeechOptions,
  SpeechResult,
  VoiceSettings,
  PronunciationDictionaryLocator,
} from "../../types/elevenLabsTTS.types";
import {
  getCharacterLimit,
  selectOptimalModel,
  generateSpeechPart,
} from "../../utils/elevenLabsTTSHelpers";

// Re-export types for backward compatibility
export type { TextToSpeechOptions, VoiceSettings, SpeechResult };

// ==================== HELPER FUNCTIONS ====================
// Moved to src/utils/elevenLabsTTSHelpers.ts

export async function generateSpeech(options: TextToSpeechOptions) {
  try {
    if (!API_KEY) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required");
    }

    // Find the voice in database to get the stored model_id
    const voice = await ElevenLabsVoice.findOne({
      voice_id: options.voice_id,
    });

    if (!voice) {
      throw new Error(
        `Voice with ID ${options.voice_id} not found in database`
      );
    }

    const output_format = options.output_format || DEFAULT_OUTPUT_FORMAT;

    // Handle single text field
    if (options.text) {
      // Calculate text length for optimal model selection
      const textLength = options.text.length;
      const textLengths = {
        hook: textLength,
        body: 0,
        conclusion: 0,
      };

      // Automatically select optimal model based on text length
      const model_id = selectOptimalModel(
        options.model_id,
        voice.verified_language_en?.model_id,
        textLengths
      );

      // Generate speech for single text
      const result = await generateSpeechPart(
        options.voice_id,
        options.text,
        model_id,
        output_format,
        "text",
        options.voice_settings,
        options.apply_text_normalization,
        options.seed,
        options.pronunciation_dictionary_locators
      );

      return {
        text_url: result.url,
        model_id: model_id,
        contentType: "audio/mpeg",
      };
    }

    // Handle hook/body/conclusion format
    if (!options.hook || !options.body || !options.conclusion) {
      throw new Error(
        "Either 'text' field OR all of 'hook', 'body', and 'conclusion' fields must be provided"
      );
    }

    // Calculate text lengths for optimal model selection
    const textLengths = {
      hook: options.hook.length,
      body: options.body.length,
      conclusion: options.conclusion.length,
    };

    // Automatically select optimal model based on text length
    const model_id = selectOptimalModel(
      options.model_id,
      voice.verified_language_en?.model_id,
      textLengths
    );

    // Generate speech for all three parts in parallel
    const [hookResult, bodyResult, conclusionResult] = await Promise.all([
      generateSpeechPart(
        options.voice_id,
        options.hook,
        model_id,
        output_format,
        "hook",
        options.voice_settings,
        options.apply_text_normalization,
        options.seed,
        options.pronunciation_dictionary_locators
      ),
      generateSpeechPart(
        options.voice_id,
        options.body,
        model_id,
        output_format,
        "body",
        options.voice_settings,
        options.apply_text_normalization,
        options.seed,
        options.pronunciation_dictionary_locators
      ),
      generateSpeechPart(
        options.voice_id,
        options.conclusion,
        model_id,
        output_format,
        "conclusion",
        options.voice_settings,
        options.apply_text_normalization,
        options.seed,
        options.pronunciation_dictionary_locators
      ),
    ]);

    return {
      hook_url: hookResult.url,
      body_url: bodyResult.url,
      conclusion_url: conclusionResult.url,
      model_id: model_id,
      contentType: "audio/mpeg",
    };
  } catch (error: any) {
    throw new Error(
      `Failed to generate speech: ${
        error.response?.data?.detail?.message || error.message
      }`
    );
  }
}
