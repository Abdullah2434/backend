import { Request, Response } from "express";
import { VideoMuteService } from "../services/videoMute.service";
import { getS3 } from "../services/s3";

/**
 * Mute video audio from URL(s)
 * POST /api/video/mute
 * Body: Array of video URLs (strings)
 * Example: ["url1", "url2", "url3"]
 * Returns: Array of objects with "urls" property
 * Example: [{ "urls": ["muted-url1"] }, { "urls": ["muted-url2"] }]
 */
export async function muteVideo(req: Request, res: Response) {
  try {
    let body = req.body;

    // Debug logging
    console.log("📥 Received request body:", JSON.stringify(body, null, 2));
    console.log("📥 Body type:", typeof body);
    console.log("📥 Is array:", Array.isArray(body));

    // Convert object with numeric keys to array if needed (for URL-encoded form data)
    if (!Array.isArray(body) && typeof body === "object" && body !== null) {
      const keys = Object.keys(body);
      const allNumericKeys = keys.every((key) => /^\d+$/.test(key));

      if (allNumericKeys && keys.length > 0) {
        console.log("🔄 Converting object with numeric keys to array");
        body = keys
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map((key) => body[key]);
        console.log("✅ Converted to array:", JSON.stringify(body, null, 2));
      }
    }

    // Validate input format - should be an array
    if (!Array.isArray(body)) {
      console.error("❌ Validation failed: Body is not an array");
      return res.status(400).json({
        success: false,
        message: "Request body must be an array of video URLs (strings)",
      });
    }

    if (body.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one video URL is required",
      });
    }

    // Extract and validate all URLs
    const urlsToProcess: string[] = [];

    for (let i = 0; i < body.length; i++) {
      const url = body[i];

      // Validate each URL
      if (typeof url !== "string" || url.trim() === "") {
        return res.status(400).json({
          success: false,
          message: `Invalid URL at index ${i}: must be a non-empty string`,
        });
      }

      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Invalid URL format at index ${i}: ${url}`,
        });
      }

      urlsToProcess.push(url.trim());
    }

    console.log(
      `🎬 Processing mute video request for ${urlsToProcess.length} video(s) from ${body.length} item(s)`
    );

    // Create service instance (will use muted-video bucket)
    const videoMuteService = new VideoMuteService();

    // Mute videos and upload to S3
    const results = await videoMuteService.muteVideosFromUrls(urlsToProcess);

    console.log(`✅ ${results.length} video(s) muted successfully`);

    // Create a map of original URLs to muted URLs
    const urlToMutedUrlMap = new Map<string, string>();
    results.forEach(({ url, result }) => {
      urlToMutedUrlMap.set(url, result.url);
    });

    // Group results back into the format: [{ "urls": ["muted-url"] }, ...]
    const responseData: { urls: string[] }[] = [];

    for (let i = 0; i < urlsToProcess.length; i++) {
      const originalUrl = urlsToProcess[i];
      const mutedUrl = urlToMutedUrlMap.get(originalUrl);

      // Each URL becomes an object with urls array
      if (mutedUrl) {
        responseData.push({ urls: [mutedUrl] });
      } else {
        // If URL failed, still include it with empty array (or skip it)
        // For now, we'll skip failed URLs to maintain clean response
      }
    }

    // Return in the format: [{ "urls": ["muted-url"] }, ...]
    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error("Error muting video(s):", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to mute video audio",
    });
  }
}
