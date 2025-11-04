import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import ElevenLabsVoice from "../models/elevenLabsVoice";

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_S3_BUCKET = "voice-elven-lab-audio";

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

interface TextToSpeechOptions {
  hook: string;
  body: string;
  conclusion: string;
  voice_id: string;
  output_format?: string;
}

interface SpeechResult {
  url: string;
  model_id: string;
  contentType: string;
}


/**
 * Generate speech for a single text part
 */
async function generateSpeechPart(
  voice_id: string,
  text: string,
  model_id: string,
  output_format: string,
  partName: string
): Promise<SpeechResult> {
  const ttsUrl = `${ELEVENLABS_TTS_URL}/${voice_id}?output_format=${output_format}`;
  
  const response = await axios.post(
    ttsUrl,
    { text, model_id },
    {
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    }
  );

  const audioBuffer = Buffer.from(response.data);
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
    model_id,
    contentType: "audio/mpeg",
  };
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

    // Get model_id from verified_language_en, fallback to default
    const model_id = voice.verified_language_en?.model_id || "eleven_multilingual_v2";
    const output_format = options.output_format || "mp3_44100_128";

    // Generate speech for all three parts in parallel
    const [hookResult, bodyResult, conclusionResult] = await Promise.all([
      generateSpeechPart(options.voice_id, options.hook, model_id, output_format, "hook"),
      generateSpeechPart(options.voice_id, options.body, model_id, output_format, "body"),
      generateSpeechPart(options.voice_id, options.conclusion, model_id, output_format, "conclusion"),
    ]);

    return {
      hook_url: hookResult.url,
      body_url: bodyResult.url,
      conclusion_url: conclusionResult.url,
      model_id: model_id,
      contentType: "audio/mpeg",
    };
  } catch (error: any) {
    console.error("Error generating speech:", error.message);
    throw new Error(
      `Failed to generate speech: ${error.response?.data?.detail?.message || error.message}`
    );
  }
}

