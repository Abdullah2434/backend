import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, readFileSync, unlink } from "fs";
import { promisify } from "util";
import { S3Service } from "./s3";
import crypto from "crypto";

const unlinkAsync = promisify(unlink);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface MuteVideoResult {
  url: string;
  s3Key: string;
  size: number;
}

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
        bucketName: "muted-video",
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
    const tempDir = tmpdir();
    const inputFile = join(
      tempDir,
      `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
    );
    const outputFile = join(
      tempDir,
      `muted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
    );

    try {
      // Step 1: Download video from URL
      console.log(`📥 Downloading video from: ${videoUrl}`);
      const videoResponse = await fetch(videoUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!videoResponse.ok) {
        throw new Error(
          `Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`
        );
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      const contentType =
        videoResponse.headers.get("content-type") || "video/mp4";

      console.log(
        `✅ Video downloaded successfully, size: ${videoBuffer.byteLength} bytes`
      );

      // Step 2: Write video to temporary file
      writeFileSync(inputFile, Buffer.from(videoBuffer));

      // Step 3: Mute audio using ffmpeg
      console.log(`🔇 Muting audio...`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputFile)
          .outputOptions([
            "-c:v", "copy", // Copy video stream without re-encoding
            "-an", // Remove audio stream
          ])
          .output(outputFile)
          .on("end", () => {
            console.log(`✅ Audio muted successfully`);
            resolve();
          })
          .on("error", (err: any) => {
            console.error("FFmpeg error:", err);
            reject(new Error(`Failed to mute audio: ${err.message}`));
          })
          .run();
      });

      // Step 4: Read muted video file
      const mutedVideoBuffer = readFileSync(outputFile);
      console.log(
        `✅ Muted video created, size: ${mutedVideoBuffer.length} bytes`
      );

      // Step 5: Upload to S3 (muted-video bucket)
      const timestamp = Date.now();
      const randomId = crypto.randomBytes(8).toString("hex");
      const s3Key = `${timestamp}_${randomId}.mp4`;

      console.log(`📤 Uploading muted video to S3...`);
      await this.s3Service.uploadVideoDirectly(
        s3Key,
        mutedVideoBuffer,
        contentType,
        {
          originalUrl: videoUrl,
          mutedAt: new Date().toISOString(),
        }
      );

      console.log(`✅ Muted video uploaded to S3: ${s3Key}`);

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
        console.warn("Error cleaning up temporary files:", error);
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
  ): Promise<{ url: string; result: MuteVideoResult }[]> {
    // Process all videos in parallel
    const results = await Promise.allSettled(
      videoUrls.map((url) => this.muteVideoFromUrl(url))
    );

    // Map results with original URLs
    const successful: { url: string; result: MuteVideoResult }[] = [];
    const failed: { index: number; url: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successful.push({
          url: videoUrls[index],
          result: result.value,
        });
      } else {
        const errorMsg = result.reason?.message || "Unknown error";
        console.error(
          `Failed to mute video ${index + 1} (${videoUrls[index]}):`,
          errorMsg
        );
        failed.push({
          index: index + 1,
          url: videoUrls[index],
          error: errorMsg,
        });
      }
    });

    // If all videos failed, throw error
    if (successful.length === 0) {
      throw new Error(
        `All videos failed to mute. Errors: ${failed.map((f) => `Video ${f.index}: ${f.error}`).join("; ")}`
      );
    }

    // If some failed, log warning but return successful ones
    if (failed.length > 0) {
      console.warn(
        `${failed.length} video(s) failed to mute, ${successful.length} succeeded`
      );
    }

    return successful;
  }
}

