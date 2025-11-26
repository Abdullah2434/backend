import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import ElevenLabsVoice from "../models/elevenLabsVoice";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { Readable } from "stream";
import { tmpdir } from "os";
import { join } from "path";
import { unlink, writeFileSync, readFileSync } from "fs";
import { promisify } from "util";

const unlinkAsync = promisify(unlink);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_S3_BUCKET = "voice-elven-lab-audio";

// Character limits per model (from ElevenLabs documentation)
const MODEL_CHARACTER_LIMITS: Record<string, number> = {
  "eleven_multilingual_v1": 10000,
  "eleven_multilingual_v2": 10000,
  "eleven_turbo_v2": 30000,
  "eleven_turbo_v2_5": 40000,
  "eleven_flash_v2": 30000,
  "eleven_flash_v2_5": 40000,
  "eleven_english_v1": 10000,
  "eleven_english_v2": 10000,
};

// Default limit for unknown models
const DEFAULT_CHARACTER_LIMIT = 10000;

// Create S3 client for voice audio bucket
function getVoiceS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
}

interface TextToSpeechOptions {
  hook: string;
  body: string;
  conclusion: string;
  voice_id: string;
  output_format?: string;
  model_id?: string; // Optional: Override model (e.g., "eleven_turbo_v2_5" for 40k chars, "eleven_flash_v2_5" for 40k chars)
  voice_settings?: VoiceSettings; // Optional: Voice settings for cloned voices
  apply_text_normalization?: "auto" | "on" | "off"; // Optional: Text normalization mode
  seed?: number | null; // Optional: Seed for deterministic sampling
  pronunciation_dictionary_locators?: Array<{
    pronunciation_dictionary_id: string;
    version_id?: string | null;
  }> | null; // Optional: Pronunciation dictionary locators
}

interface SpeechResult {
  url: string;
  buffer: Buffer; // Include buffer for concatenation
  model_id: string;
  contentType: string;
}


/**
 * Get character limit for a model
 */
function getCharacterLimit(model_id: string): number {
  return MODEL_CHARACTER_LIMITS[model_id] || DEFAULT_CHARACTER_LIMIT;
}

/**
 * Normalize text before sending to ElevenLabs to prevent word additions
 * - Normalizes whitespace
 * - Handles special characters
 * - Ensures proper spacing around punctuation
 */
function normalizeTextForTTS(text: string): string {
  if (!text) return text;

  // Normalize whitespace (replace multiple spaces/tabs/newlines with single space)
  let normalized = text.replace(/\s+/g, ' ').trim();

  // Ensure proper spacing around punctuation (but preserve existing spacing)
  // This helps ElevenLabs understand sentence boundaries better
  normalized = normalized.replace(/([.!?])([A-Za-z])/g, '$1 $2');

  // Remove any zero-width characters that might confuse TTS
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Ensure no leading/trailing punctuation without context
  normalized = normalized.trim();

  return normalized;
}

/**
 * Split text into chunks that respect the character limit
 * Tries to split at sentence boundaries when possible
 * Improved to prevent word cutting that causes ElevenLabs to add words
 */
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at sentence boundary (., !, ?) with proper spacing
    let splitIndex = maxLength;
    const sentenceEnders = /[.!?]\s+/g;
    let match;
    let lastMatchEnd = 0;
    const matches: Array<{ index: number; end: number }> = [];

    // Find all sentence boundaries
    while ((match = sentenceEnders.exec(remaining)) !== null) {
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
      });
    }

    // Find the best sentence boundary before maxLength
    for (const m of matches) {
      if (m.end <= maxLength && m.end > lastMatchEnd) {
        splitIndex = m.end;
        lastMatchEnd = m.end;
      }
    }

    // If no sentence boundary found, try to split at word boundary
    // But ensure we don't cut too close to the start (at least 70% of maxLength)
    if (splitIndex === maxLength || splitIndex < maxLength * 0.7) {
      const wordBoundary = remaining.lastIndexOf(' ', maxLength);
      if (wordBoundary > maxLength * 0.7) {
        // Only use word boundary if it's reasonable (at least 70% of limit)
        splitIndex = wordBoundary + 1;
      } else {
        // If we can't find a good boundary, force split but log warning
        // This should rarely happen with proper text
        console.warn(
          `Warning: Forcing text split at character ${maxLength} without natural boundary. This may cause TTS issues.`
        );
        splitIndex = maxLength;
      }
    }

    // Extract chunk and continue with remaining text
    const chunk = remaining.substring(0, splitIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

/**
 * Generate speech for a single text chunk
 */
async function generateSpeechChunk(
  voice_id: string,
  text: string,
  model_id: string,
  output_format: string,
  voice_settings?: VoiceSettings,
  apply_text_normalization?: "auto" | "on" | "off",
  seed?: number | null,
  pronunciation_dictionary_locators?: Array<{
    pronunciation_dictionary_id: string;
    version_id?: string | null;
  }> | null
): Promise<Buffer> {
  const ttsUrl = `${ELEVENLABS_TTS_URL}/${voice_id}?output_format=${output_format}`;
  
  // Normalize text before sending to prevent word additions
  const normalizedText = normalizeTextForTTS(text);
  
  // Log the exact text being sent for debugging (first 200 chars)
  const preview = normalizedText.length > 200 
    ? normalizedText.substring(0, 200) + "..." 
    : normalizedText;
  
  // Log original vs normalized text if they differ (for debugging)
  if (text !== normalizedText && process.env.NODE_ENV === "development") {
    console.log(`[TTS] Text normalized: "${text.substring(0, 100)}" -> "${normalizedText.substring(0, 100)}"`);
  }
  
  // Build request body with optional parameters
  // Use normalized text to prevent ElevenLabs from adding words
  const requestBody: any = { 
    text: normalizedText, 
    model_id 
  };
  
  // Add voice_settings if provided
  if (voice_settings) {
    requestBody.voice_settings = voice_settings;
  }
  
  // Add apply_text_normalization if provided (defaults to "auto" for better pronunciation)
  if (apply_text_normalization !== undefined) {
    requestBody.apply_text_normalization = apply_text_normalization;
  } else {
    // Default to "auto" for automatic text normalization (better pronunciation)
    requestBody.apply_text_normalization = "auto";
  }
  
  // Add seed for deterministic sampling if provided
  if (seed !== undefined && seed !== null) {
    requestBody.seed = seed;
  }
  
  // Add pronunciation dictionary locators if provided
  if (pronunciation_dictionary_locators && pronunciation_dictionary_locators.length > 0) {
    requestBody.pronunciation_dictionary_locators = pronunciation_dictionary_locators;
  }
  
  try {
    const response = await axios.post(
      ttsUrl,
      requestBody,
      {
        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const audioBuffer = Buffer.from(response.data);
    
    return audioBuffer;
  } catch (error: any) {
    console.error(`[TTS Error] Failed to generate speech for text: "${preview}"`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Concatenate multiple audio buffers into a single MP3 file
 */
async function concatenateAudioChunks(chunks: Buffer[]): Promise<Buffer> {
  if (chunks.length === 1) {
    return chunks[0];
  }

  const tempDir = tmpdir();
  const tempFiles: string[] = [];
  const outputFile = join(tempDir, `concatenated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);

  try {
    // Write each chunk to a temporary file
    for (let i = 0; i < chunks.length; i++) {
      const tempFile = join(tempDir, `chunk_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);
      writeFileSync(tempFile, chunks[i]);
      tempFiles.push(tempFile);
    }

    // Create a file list for ffmpeg concat
    const concatFile = join(tempDir, `concat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`);
    const concatContent = tempFiles.map(file => `file '${file}'`).join('\n');
    writeFileSync(concatFile, concatContent);
    tempFiles.push(concatFile);

    // Concatenate using ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputFile)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    // Read concatenated file
    const concatenatedBuffer = readFileSync(outputFile);
    
    // Cleanup
    try {
      await unlinkAsync(outputFile);
    } catch (e) {
      // Ignore cleanup errors
    }

    return concatenatedBuffer;
  } finally {
    // Cleanup temporary files
    for (const file of tempFiles) {
      try {
        await unlinkAsync(file);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Generate speech for a single text part (with chunking support for long text)
 */
async function generateSpeechPart(
  voice_id: string,
  text: string,
  model_id: string,
  output_format: string,
  partName: string,
  voice_settings?: VoiceSettings,
  apply_text_normalization?: "auto" | "on" | "off",
  seed?: number | null,
  pronunciation_dictionary_locators?: Array<{
    pronunciation_dictionary_id: string;
    version_id?: string | null;
  }> | null
): Promise<SpeechResult> {
  const characterLimit = getCharacterLimit(model_id);
  
  // Normalize text first to prevent issues
  const normalizedText = normalizeTextForTTS(text);
  const textLength = normalizedText.length;

  // Check if text exceeds limit
  if (textLength > characterLimit) {
    const chunks = splitTextIntoChunks(normalizedText, characterLimit);
    // Generate speech for each chunk sequentially to maintain context
    // (Sequential instead of parallel to avoid context loss between chunks)
    const audioChunks: Buffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const audioBuffer = await generateSpeechChunk(
        voice_id, 
        chunks[i], 
        model_id, 
        output_format, 
        voice_settings,
        apply_text_normalization,
        seed,
        pronunciation_dictionary_locators
      );
      audioChunks.push(audioBuffer);
    }

    const finalAudioBuffer = await concatenateAudioChunks(audioChunks);


    // Upload to S3
    const timestamp = Date.now();
    const hash = crypto.createHash("md5").update(`${text}_${partName}`).digest("hex").substring(0, 8);
    const s3Key = `voices/${voice_id}/${partName}/${timestamp}_${hash}.mp3`;

    const s3Client = getVoiceS3Client();
    const putCommand = new PutObjectCommand({
      Bucket: VOICE_S3_BUCKET,
      Key: s3Key,
      Body: finalAudioBuffer,
      ContentType: "audio/mpeg",
      Metadata: {
        voice_id,
        model_id,
        part: partName,
        text_hash: hash,
        chunks: chunks.length.toString(),
      },
    });

    await s3Client.send(putCommand);

    // Generate signed URL
    const expiresIn = parseInt(process.env.VOICE_AUDIO_URL_EXPIRY_SECONDS || "604800");
    const getCommand = new GetObjectCommand({
      Bucket: VOICE_S3_BUCKET,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });
    const baseUrl = signedUrl.split('?')[0];

    return {
      url: baseUrl,
      buffer: finalAudioBuffer, // Return buffer for full audio concatenation
      model_id,
      contentType: "audio/mpeg",
    };
  }

  // Text is within limit, process normally (use normalized text)
  const audioBuffer = await generateSpeechChunk(
    voice_id, 
    normalizedText, 
    model_id, 
    output_format, 
    voice_settings,
    apply_text_normalization,
    seed,
    pronunciation_dictionary_locators
  );
  const timestamp = Date.now();
  const hash = crypto.createHash("md5").update(`${text}_${partName}`).digest("hex").substring(0, 8);
  const s3Key = `voices/${voice_id}/${partName}/${timestamp}_${hash}.mp3`;

  const s3Client = getVoiceS3Client();
  const putCommand = new PutObjectCommand({
    Bucket: VOICE_S3_BUCKET,
    Key: s3Key,
    Body: audioBuffer,
    ContentType: "audio/mpeg",
    Metadata: {
      voice_id,
      model_id,
      part: partName,
      text_hash: hash,
    },
  });

  await s3Client.send(putCommand);

  // Generate signed URL (valid for 7 days by default)
  const expiresIn = parseInt(process.env.VOICE_AUDIO_URL_EXPIRY_SECONDS || "604800"); // 7 days = 604800 seconds
  const getCommand = new GetObjectCommand({
    Bucket: VOICE_S3_BUCKET,
    Key: s3Key,
  });

  const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn });

  // Extract base URL without query parameters (just the .mp3 URL)
  const baseUrl = signedUrl.split('?')[0];

  return {
    url: baseUrl, // Return clean MP3 URL without query parameters
    buffer: audioBuffer, // Return buffer for full audio concatenation
    model_id,
    contentType: "audio/mpeg",
  };
}

/**
 * Automatically select the best model based on text length
 * Uses higher-limit models for longer text to avoid truncation
 */
function selectOptimalModel(
  providedModel: string | undefined,
  voiceDefaultModel: string | undefined,
  textLengths: { hook: number; body: number; conclusion: number }
): string {
  // If model is explicitly provided, use it
  if (providedModel) {
    return providedModel;
  }

  // Find the longest text part
  const maxLength = Math.max(textLengths.hook, textLengths.body, textLengths.conclusion);

  // If any text part exceeds 10k, automatically use turbo_v2_5 (40k limit)
  if (maxLength > 10000) {

    return "eleven_turbo_v2_5";
  }

  // If text is between 5k-10k, use turbo_v2 (30k limit) for better quality
  if (maxLength > 5000) {
  
    return "eleven_turbo_v2";
  }

  // For shorter text, use voice's default or fallback to multilingual_v2
  return voiceDefaultModel || "eleven_multilingual_v2";
}

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
      throw new Error(`Voice with ID ${options.voice_id} not found in database`);
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
    
    const output_format = options.output_format || "mp3_44100_128";
    
    // Log model selection for debugging
    const characterLimit = getCharacterLimit(model_id);
   

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
      `Failed to generate speech: ${error.response?.data?.detail?.message || error.message}`
    );
  }
}

