import PendingCaptions from "../models/PendingCaptions";
import VideoService from "./video.service";

export class PostWebhookDynamicGenerationService {
  private videoService: VideoService;

  constructor() {
    this.videoService = new VideoService();
  }

  /**
   * Process dynamic generation for videos after webhooks complete
   * This is called by webhook handlers to generate dynamic content
   * Works even if video is still in "processing" status
   */
  async processDynamicGenerationForVideo(
    videoId: string,
    email: string,
    title: string
  ): Promise<void> {
    try {
      console.log(`🔄 Processing dynamic generation for video: ${videoId}`);
      console.log(`📧 Email: ${email}`);
      console.log(`📝 Title: ${title}`);

      // Find pending captions that need dynamic generation
      const pendingCaption = await PendingCaptions.findOne({
        email: email,
        title: title,
        isDynamic: true,
        isPending: true,
      });

      if (!pendingCaption) {
        console.log(`📝 No pending dynamic generation found for: ${title}`);
        return;
      }

      // Check video status (but don't require it to be "ready")
      const video = await this.videoService.getVideo(videoId);
      if (video) {
        console.log(
          `📹 Video status: ${video.status} (dynamic generation will proceed regardless)`
        );
      } else {
        console.log(
          `⚠️ Video not found in database, proceeding with dynamic generation anyway`
        );
      }

      console.log(`📝 Found pending dynamic generation for: ${title}`);
      console.log(`📝 Topic: ${pendingCaption.topic}`);
      console.log(`📝 Key Points: ${pendingCaption.keyPoints}`);

      // Generate DYNAMIC posts using Smart Memory System
      const { DynamicPostGenerationService } = await import(
        "./dynamicPostGeneration.service"
      );

      const dynamicPosts =
        await DynamicPostGenerationService.generateDynamicPosts(
          pendingCaption.topic!,
          pendingCaption.keyPoints!,
          pendingCaption.userContext!,
          pendingCaption.userId!,
          pendingCaption.platforms!
        );

      console.log(`🎯 Generated ${dynamicPosts.length} dynamic posts`);

      // Convert dynamic posts to traditional caption format for compatibility
      const captions = {
        instagram_caption:
          dynamicPosts.find((p: any) => p.platform === "instagram")?.content ||
          "",
        facebook_caption:
          dynamicPosts.find((p: any) => p.platform === "facebook")?.content ||
          "",
        linkedin_caption:
          dynamicPosts.find((p: any) => p.platform === "linkedin")?.content ||
          "",
        twitter_caption:
          dynamicPosts.find((p: any) => p.platform === "twitter")?.content ||
          "",
        tiktok_caption:
          dynamicPosts.find((p: any) => p.platform === "tiktok")?.content || "",
        youtube_caption:
          dynamicPosts.find((p: any) => p.platform === "youtube")?.content ||
          "",
      };

      // Update the pending captions with generated content
      await PendingCaptions.findOneAndUpdate(
        {
          email: email,
          title: title,
        },
        {
          captions,
          dynamicPosts: dynamicPosts,
          isPending: false, // Mark as completed
        },
        { new: true }
      );

      // Update the video with the generated captions (works even if video is processing)
      try {
        await this.videoService.updateVideoCaptions(videoId, captions);
        console.log(`✅ Captions updated in video record for: ${videoId}`);
      } catch (captionUpdateError) {
        console.warn(
          `⚠️ Could not update video captions (video may still be processing): ${captionUpdateError}`
        );
        // Continue anyway - captions are stored in PendingCaptions
      }

      console.log(`✅ Dynamic generation completed for video: ${videoId}`);
      console.log(
        `📱 Generated captions for platforms: ${pendingCaption.platforms?.join(
          ", "
        )}`
      );
      console.log(
        `📝 Captions stored in PendingCaptions and will be applied when video is ready`
      );
    } catch (error: any) {
      console.error(
        `❌ Error processing dynamic generation for video ${videoId}:`,
        error
      );

      // Mark as failed in pending captions
      await PendingCaptions.findOneAndUpdate(
        {
          email: email,
          title: title,
        },
        {
          isPending: false,
          isDynamic: false, // Fallback to non-dynamic
        }
      );

      // Generate fallback captions
      try {
        // Try to fetch pending caption again for fallback data
        const fallbackPendingCaption = await PendingCaptions.findOne({
          email: email,
          title: title,
        });

        const fallbackCaptions = await this.generateFallbackCaptions(
          fallbackPendingCaption?.topic || title,
          fallbackPendingCaption?.keyPoints || "",
          fallbackPendingCaption?.userContext || {
            name: "Real Estate Professional",
            position: "Real Estate Professional",
            companyName: "Real Estate Company",
            city: "Your City",
            socialHandles: "@realestate",
          }
        );

        // Try to update video captions, but don't fail if video is still processing
        try {
          await this.videoService.updateVideoCaptions(
            videoId,
            fallbackCaptions
          );
          console.log(
            `🔄 Fallback captions generated and updated for video: ${videoId}`
          );
        } catch (updateError) {
          console.warn(
            `⚠️ Could not update video with fallback captions (video may still be processing): ${updateError}`
          );
          // Store in PendingCaptions as fallback
          await PendingCaptions.findOneAndUpdate(
            { email: email, title: title },
            { captions: fallbackCaptions, isPending: false, isDynamic: false },
            { upsert: true }
          );
          console.log(
            `📝 Fallback captions stored in PendingCaptions for: ${videoId}`
          );
        }
      } catch (fallbackError) {
        console.error(
          `❌ Failed to generate fallback captions for video ${videoId}:`,
          fallbackError
        );
      }
    }
  }

  /**
   * Generate fallback captions using traditional method
   */
  private async generateFallbackCaptions(
    topic: string,
    keyPoints: string,
    userContext: any
  ): Promise<any> {
    const { CaptionGenerationService } = await import(
      "./captionGeneration.service"
    );

    return await CaptionGenerationService.generateCaptions(
      topic,
      keyPoints,
      userContext
    );
  }

  /**
   * Check if a video has pending dynamic generation
   */
  async hasPendingDynamicGeneration(
    email: string,
    title: string
  ): Promise<boolean> {
    const pendingCaption = await PendingCaptions.findOne({
      email: email,
      title: title,
      isDynamic: true,
      isPending: true,
    });

    return !!pendingCaption;
  }

  /**
   * Get pending dynamic generation data
   */
  async getPendingDynamicGeneration(
    email: string,
    title: string
  ): Promise<any> {
    return await PendingCaptions.findOne({
      email: email,
      title: title,
      isDynamic: true,
      isPending: true,
    });
  }
}

export default PostWebhookDynamicGenerationService;
