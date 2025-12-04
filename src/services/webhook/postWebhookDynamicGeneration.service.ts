import PendingCaptions from "../../models/PendingCaptions";
import UserVideoSettings from "../../models/UserVideoSettings";
import { VideoService } from "../video";
import {
  getUserContextFromSettings,
  convertDynamicPostsToCaptions,
  type UserContext,
  type SocialMediaCaptions,
} from "../../utils/postWebhookDynamicGenerationHelpers";

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
      // Find pending captions that need generation (dynamic or fallback)
      const pendingCaption = await PendingCaptions.findOne({
        email: email,
        title: title,
        isPending: true,
      });

      if (!pendingCaption) {
        return;
      }

      // Check video status (but don't require it to be "ready")
      await this.videoService.getVideo(videoId);

      let dynamicPosts: any[] = [];
      let captions: SocialMediaCaptions;

      // Generate DYNAMIC posts using Smart Memory System if dynamic is enabled
      if (
        pendingCaption.isDynamic &&
        pendingCaption.userId &&
        pendingCaption.platforms
      ) {
        try {
          // Get user settings to retrieve language preference
          const userSettings = await UserVideoSettings.findOne({
            email: email,
          });
          const language = userSettings?.language;

          const { DynamicPostGenerationService } = await import("../content");

          dynamicPosts =
            await DynamicPostGenerationService.generateDynamicPosts(
              pendingCaption.topic!,
              pendingCaption.keyPoints!,
              pendingCaption.userContext!,
              pendingCaption.userId!,
              pendingCaption.platforms!,
              language
            );

          // Convert dynamic posts to traditional caption format for compatibility
          captions = convertDynamicPostsToCaptions(dynamicPosts);
        } catch (dynamicError) {
          // Fall through to generate fallback captions
          captions = await this.generateFallbackCaptions(
            pendingCaption.topic || title,
            pendingCaption.keyPoints || "",
            pendingCaption.userContext ||
              (await getUserContextFromSettings(email)),
            email
          );
        }
      } else {
        captions = await this.generateFallbackCaptions(
          pendingCaption.topic || title,
          pendingCaption.keyPoints || "",
          pendingCaption.userContext ||
            (await getUserContextFromSettings(email)),
          email
        );
      }

      await this.updatePendingCaptions(
        email,
        title,
        captions,
        dynamicPosts.length > 0 ? dynamicPosts : undefined
      );

      // Update the video with the generated captions (works even if video is processing)
      await this.updateVideoCaptionsSafely(videoId, captions);
    } catch (error: any) {
      await this.handleGenerationError(email, title, videoId);
    }
  }

  /**
   * Generate fallback captions using traditional method
   */
  private async generateFallbackCaptions(
    topic: string,
    keyPoints: string,
    userContext: UserContext,
    email: string
  ): Promise<SocialMediaCaptions> {
    // Get user settings to retrieve language preference
    const userSettings = await UserVideoSettings.findOne({
      email: email,
    });
    const language = userSettings?.language;

    const { CaptionGenerationService } = await import("../content");

    const captions = await CaptionGenerationService.generateCaptions(
      topic,
      keyPoints,
      userContext,
      language
    );

    return captions;
  }

  /**
   * Update pending captions record
   */
  private async updatePendingCaptions(
    email: string,
    title: string,
    captions: SocialMediaCaptions,
    dynamicPosts?: any[]
  ): Promise<void> {
    await PendingCaptions.findOneAndUpdate(
      {
        email: email,
        title: title,
      },
      {
        captions,
        dynamicPosts: dynamicPosts || undefined,
        isPending: false,
      },
      { new: true }
    );
  }

  /**
   * Update video captions safely (doesn't throw if video is still processing)
   */
  private async updateVideoCaptionsSafely(
    videoId: string,
    captions: SocialMediaCaptions
  ): Promise<void> {
    try {
      await this.videoService.updateVideoCaptions(videoId, captions);
    } catch (captionUpdateError) {
      // Continue anyway - captions are stored in PendingCaptions
    }
  }

  /**
   * Handle generation error by marking as failed and generating fallback
   */
  private async handleGenerationError(
    email: string,
    title: string,
    videoId: string
  ): Promise<void> {
    // Mark as failed in pending captions
    await PendingCaptions.findOneAndUpdate(
      {
        email: email,
        title: title,
      },
      {
        isPending: false,
        isDynamic: false,
      }
    );

    // Generate fallback captions
    try {
      const fallbackPendingCaption = await PendingCaptions.findOne({
        email: email,
        title: title,
      });

      const fallbackCaptions = await this.generateFallbackCaptions(
        fallbackPendingCaption?.topic || title,
        fallbackPendingCaption?.keyPoints || "",
        fallbackPendingCaption?.userContext ||
          (await getUserContextFromSettings(email)),
        email
      );

      // Try to update video captions, but don't fail if video is still processing
      try {
        await this.videoService.updateVideoCaptions(videoId, fallbackCaptions);
      } catch (updateError) {
        // Store in PendingCaptions as fallback
        await PendingCaptions.findOneAndUpdate(
          { email: email, title: title },
          {
            captions: fallbackCaptions,
            isPending: false,
            isDynamic: false,
          },
          { upsert: true }
        );
      }
    } catch (fallbackError) {
      // Silently handle fallback error
    }
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
