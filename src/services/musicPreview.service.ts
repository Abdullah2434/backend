import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { PassThrough } from "stream";
import { S3Service } from "./s3";

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class MusicPreviewService {
  private s3Service: S3Service;

  constructor(s3Service: S3Service) {
    this.s3Service = s3Service;
  }

  /**
   * Generate 15-second preview clip from audio buffer
   */
  async generatePreviewClip(inputBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const outputBuffers: Buffer[] = [];
      const inputStream = new PassThrough();
      const outputStream = new PassThrough();

      // Set up ffmpeg command
      const ffmpegCommand = ffmpeg()
        .input(inputStream)
        .inputFormat("mp3")
        .seekInput(0)
        .duration(15)
        .audioFilters("afade=t=out:st=14:d=1")
        .format("mp3")
        .on("error", (err: any) => {
          console.error("FFmpeg error:", err);
          reject(new Error(`Preview generation failed: ${err.message}`));
        })
        .on("end", () => {
          const outputBuffer = Buffer.concat(outputBuffers);
          resolve(outputBuffer);
        });

      // Pipe output to collect data
      ffmpegCommand.pipe(outputStream);

      outputStream.on("data", (chunk: any) => {
        outputBuffers.push(chunk);
      });

      // Write input buffer to input stream
      inputStream.end(inputBuffer);
    });
  }

  /**
   * Process and upload music track with preview generation
   */
  async processAndUploadMusicTrack(
    trackId: string,
    energyCategory: string,
    fullTrackBuffer: Buffer,
    filename: string,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<{
    fullTrackS3Key: string;
    previewS3Key: string;
    fullTrackUrl: string;
    previewUrl: string;
  }> {
    try {
      // Generate S3 keys
      const fullTrackS3Key = this.s3Service.generateMusicS3Key(
        energyCategory,
        trackId,
        filename
      );
      const previewS3Key = this.s3Service.generateMusicS3Key(
        energyCategory,
        trackId,
        `preview_${filename}`
      );

      // Upload full track
      await this.s3Service.uploadMusicTrack(
        fullTrackS3Key,
        fullTrackBuffer,
        contentType,
        metadata
      );

      // Generate preview clip
      const previewBuffer = await this.generatePreviewClip(fullTrackBuffer);

      // Upload preview
      await this.s3Service.uploadMusicPreview(
        previewS3Key,
        previewBuffer,
        contentType,
        { ...metadata, isPreview: "true" }
      );

      // Generate URLs
      const fullTrackUrl = await this.s3Service.getMusicTrackUrl(
        fullTrackS3Key
      );
      const previewUrl = await this.s3Service.getMusicTrackUrl(previewS3Key);

      return {
        fullTrackS3Key,
        previewS3Key,
        fullTrackUrl,
        previewUrl,
      };
    } catch (error: any) {
      console.error("Error processing music track:", error);
      throw new Error(`Failed to process music track: ${error.message}`);
    }
  }

  /**
   * Get audio duration from buffer
   */
  async getAudioDuration(buffer: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const inputStream = new PassThrough();

      ffmpeg()
        .input(inputStream)
        .inputFormat("mp3")
        .ffprobe((err: any, data: any) => {
          if (err) {
            reject(new Error(`Failed to get duration: ${err.message}`));
          } else {
            const duration = data.format.duration || 0;
            resolve(Math.round(duration));
          }
        });

      // Write input buffer to input stream
      inputStream.end(buffer);
    });
  }
}

export default MusicPreviewService;
