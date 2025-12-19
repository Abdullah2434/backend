import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, readFileSync, unlink } from "fs";
import { promisify } from "util";
import crypto from "crypto";
import { AudioMergeResponse } from "../../types/audioMerge.types";
import { VOICE_S3_BUCKET } from "../../constants/elevenLabsTTS.constants";

const unlinkAsync = promisify(unlink);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Constants
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/**
 * Get S3 client for voice audio bucket
 */
function getVoiceS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

/**
 * Download audio file from URL
 */
async function downloadAudioFromUrl(audioUrl: string): Promise<Buffer> {
  const audioResponse = await fetch(audioUrl, {
    method: "GET",
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
    },
  });

  if (!audioResponse.ok) {
    throw new Error(
      `Failed to download audio from ${audioUrl}: ${audioResponse.status} ${audioResponse.statusText}`
    );
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  return Buffer.from(audioBuffer);
}

/**
 * Get audio duration from file using ffprobe
 */
function getAudioDurationFromFile(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath).ffprobe((err: any, data: any) => {
      if (err) {
        reject(new Error(`Failed to get audio duration: ${err.message}`));
        return;
      }

      const duration = data.format?.duration;
      if (duration === undefined || duration === null) {
        reject(new Error("Could not determine audio duration"));
        return;
      }

      resolve(duration);
    });
  });
}

/**
 * Merge multiple audio files using ffmpeg concat
 */
async function mergeAudioFiles(audioBuffers: Buffer[]): Promise<Buffer> {
  if (audioBuffers.length === 1) {
    return audioBuffers[0];
  }

  const tempDir = tmpdir();
  const tempFiles: string[] = [];
  const outputFile = join(
    tempDir,
    `merged_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.mp3`
  );

  try {
    // Write each audio buffer to a temporary file
    for (let i = 0; i < audioBuffers.length; i++) {
      const tempFile = join(
        tempDir,
        `audio_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.mp3`
      );
      writeFileSync(tempFile, audioBuffers[i]);
      tempFiles.push(tempFile);
    }

    // Create a file list for ffmpeg concat
    const concatFile = join(
      tempDir,
      `concat_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.txt`
    );
    const concatContent = tempFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
    writeFileSync(concatFile, concatContent);
    tempFiles.push(concatFile);

    // Concatenate using ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions(["-c", "copy"])
        .output(outputFile)
        .on("end", () => resolve())
        .on("error", (err) => reject(new Error(`Failed to merge audio: ${err.message}`)))
        .run();
    });

    // Read merged file
    const mergedBuffer = readFileSync(outputFile);

    // Cleanup output file
    try {
      await unlinkAsync(outputFile);
    } catch (e) {
      // Ignore cleanup errors
    }

    return mergedBuffer;
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
 * Upload merged audio to S3 and return URL
 */
async function uploadMergedAudioToS3(
  audioBuffer: Buffer,
  totalFiles: number
): Promise<string> {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString("hex");
  const s3Key = `merged/merged_${timestamp}_${randomId}.mp3`;

  const s3Client = getVoiceS3Client();
  const putCommand = new PutObjectCommand({
    Bucket: VOICE_S3_BUCKET,
    Key: s3Key,
    Body: audioBuffer,
    ContentType: "audio/mpeg",
    Metadata: {
      totalFiles: totalFiles.toString(),
      mergedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(putCommand);

  // Generate public URL (without signed parameters)
  const region = process.env.AWS_REGION || "us-east-1";
  const baseUrl = `https://${VOICE_S3_BUCKET}.s3.${region}.amazonaws.com/${s3Key}`;

  return baseUrl;
}

export class AudioMergeService {
  /**
   * Merge multiple audio files from URLs and upload to S3
   * Downloads all audio files, merges them in order, uploads to S3, and returns the merged URL
   */
  async mergeAudioFilesFromUrls(urls: string[]): Promise<AudioMergeResponse> {
    if (urls.length === 0) {
      throw new Error("At least one URL is required");
    }

    // Step 1: Download all audio files in parallel
    const downloadPromises = urls.map((url) => downloadAudioFromUrl(url));
    const audioBuffers = await Promise.all(downloadPromises);

    // Step 2: Merge audio files
    const mergedBuffer = await mergeAudioFiles(audioBuffers);

    // Step 3: Upload merged audio to S3
    const mergedUrl = await uploadMergedAudioToS3(mergedBuffer, urls.length);

    // Step 4: Calculate total duration from merged file
    // Write merged buffer to temp file to get duration
    const tempFile = join(
      tmpdir(),
      `duration_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.mp3`
    );
    try {
      writeFileSync(tempFile, mergedBuffer);
      const totalDuration = await getAudioDurationFromFile(tempFile);
      
      return {
        url: mergedUrl,
        totalDuration,
        totalFiles: urls.length,
      };
    } finally {
      // Cleanup temp file
      try {
        await unlinkAsync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

export default AudioMergeService;

