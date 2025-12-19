import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, unlink } from "fs";
import { promisify } from "util";
import { AudioDurationResponse } from "../../types/audioDuration.types";

const unlinkAsync = promisify(unlink);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Constants
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/**
 * Generate temporary file path for audio file
 * Uses generic extension as ffprobe can detect format from content
 */
function generateTempAudioFilePath(): string {
  const tempDir = tmpdir();
  return join(
    tempDir,
    `audio_${Date.now()}_${Math.random().toString(36).slice(2, 11)}.tmp`
  );
}

/**
 * Format duration in seconds to "MM:SS" or "H:MM:SS" format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Download audio file from URL
 */
async function downloadAudioFromUrl(audioUrl: string): Promise<{
  buffer: ArrayBuffer;
  contentType: string;
}> {
  const audioResponse = await fetch(audioUrl, {
    method: "GET",
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
    },
  });

  if (!audioResponse.ok) {
    throw new Error(
      `Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`
    );
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  const contentType =
    audioResponse.headers.get("content-type") || "audio/mpeg";

  return {
    buffer: audioBuffer,
    contentType,
  };
}

/**
 * Get audio duration from file using ffprobe
 */
function getAudioDurationFromFile(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, data: any) => {
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

export class AudioDurationService {
  /**
   * Get audio duration from URL
   * Downloads the audio file, extracts duration using ffprobe, and returns formatted result
   */
  async getAudioDuration(audioUrl: string): Promise<AudioDurationResponse> {
    const tempFile = generateTempAudioFilePath();

    try {
      // Step 1: Download audio from URL
      const { buffer: audioBuffer } = await downloadAudioFromUrl(audioUrl);

      // Step 2: Write audio to temporary file
      writeFileSync(tempFile, Buffer.from(audioBuffer));

      // Step 3: Get duration using ffprobe
      const duration = await getAudioDurationFromFile(tempFile);

      // Step 4: Format duration
      const durationFormatted = formatDuration(duration);

      return {
        duration,
        durationFormatted,
        url: audioUrl,
      };
    } finally {
      // Cleanup temporary file
      try {
        await unlinkAsync(tempFile).catch(() => {
          // Silently handle cleanup errors
        });
      } catch (error) {
        // Silently handle cleanup errors
      }
    }
  }
}

export default AudioDurationService;

