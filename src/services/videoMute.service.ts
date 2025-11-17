import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { writeFileSync, readFileSync, unlink } from "fs";
import { promisify } from "util";
import { S3Service } from "./s3";
import { MuteVideoResult, MuteVideoProcessResult } from "../types/services/videoMute.types";
import {
  generateTempInputFilePath,
  generateTempOutputFilePath,
  generateMutedVideoS3Key,
  getMutedVideoBucketName,
  downloadVideoFromUrl,
  processMuteVideoResults,
  validateMuteResults,
} from "../utils/videoMuteHelpers";

const unlinkAsync = promisify(unlink);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class VideoMuteService {
  private s3Service: S3Service;

  constructor(s3Service?: S3Service) {
    // Use provided S3Service or create one for muted-video bucket
    if (s3Service) {
      this.s3Service = s3Service;
    } else {
      // Create S3Service instance for muted-video bucket
      const region = process.env.AWS_REGION || "us-east-1";
      this.s3Service = new S3Service({
        region: region,
        bucketName: getMutedVideoBucketName(),
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        endpoint: process.env.AWS_S3_ENDPOINT,
        forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
      });
    }
  }

  /**
   * Download video from URL, mute audio, and upload to S3
   * Returns the URL of the muted video
   */
  async muteVideoFromUrl(videoUrl: string): Promise<MuteVideoResult> {
    const inputFile = generateTempInputFilePath();
    const outputFile = generateTempOutputFilePath();

    try {
      // Step 1: Download video from URL
      const { buffer: videoBuffer, contentType } =
        await downloadVideoFromUrl(videoUrl);

      // Step 2: Write video to temporary file
      writeFileSync(inputFile, Buffer.from(videoBuffer));

      // Step 3: Mute audio using ffmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputFile)
          .outputOptions([
            "-c:v", "copy", // Copy video stream without re-encoding
            "-an", // Remove audio stream
          ])
          .output(outputFile)
          .on("end", () => {
            resolve();
          })
          .on("error", (err: any) => {
            reject(new Error(`Failed to mute audio: ${err.message}`));
          })
          .run();
      });

      // Step 4: Read muted video file
      const mutedVideoBuffer = readFileSync(outputFile);

      // Step 5: Upload to S3 (muted-video bucket)
      const s3Key = generateMutedVideoS3Key();

      await this.s3Service.uploadVideoDirectly(
        s3Key,
        mutedVideoBuffer,
        contentType,
        {
          originalUrl: videoUrl,
          mutedAt: new Date().toISOString(),
        }
      );

      // Step 6: Generate simple URL (without query parameters)
      const mutedVideoUrl = this.s3Service.getVideoUrl(s3Key);

      return {
        url: mutedVideoUrl,
        s3Key: s3Key,
        size: mutedVideoBuffer.length,
      };
    } finally {
      // Cleanup temporary files
      try {
        if (inputFile) await unlinkAsync(inputFile).catch(() => {});
        if (outputFile) await unlinkAsync(outputFile).catch(() => {});
      } catch (error) {
        // Silently handle cleanup errors
      }
    }
  }

  /**
   * Mute multiple videos from URLs
   * Processes videos in parallel
   * Returns results with original URL mapping for successful videos, throws error if all fail
   */
  async muteVideosFromUrls(
    videoUrls: string[]
  ): Promise<MuteVideoProcessResult[]> {
    // Process all videos in parallel
    const results = await Promise.allSettled(
      videoUrls.map((url) => this.muteVideoFromUrl(url))
    );

    // Process results
    const { successful, failed } = processMuteVideoResults(
      results,
      videoUrls
    );

    // Validate that at least one video was successfully muted
    validateMuteResults(successful, failed);

    // If some failed, log warning but return successful ones
    if (failed.length > 0) {
      console.warn(
        `${failed.length} video(s) failed to mute:`,
        failed.map((f) => `Video ${f.index} (${f.url}): ${f.error}`)
      );
    }

    return successful;
  }
}

