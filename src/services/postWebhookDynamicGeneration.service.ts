import PendingCaptions from "../models/PendingCaptions";
import UserVideoSettings from "../models/UserVideoSettings";
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
      const video = await this.videoService.getVideo(videoId);
      if (video) {
      
      } else {
       
      }

   

      let dynamicPosts: any[] = [];
      let captions: any;

      // Generate DYNAMIC posts using Smart Memory System if dynamic is enabled
      if (pendingCaption.isDynamic && pendingCaption.userId && pendingCaption.platforms) {
        try {
          // Get user settings to retrieve language preference
          const userSettings = await UserVideoSettings.findOne({
            email: email,
          });
          const language = userSettings?.language;

          const { DynamicPostGenerationService } = await import(
            "./dynamicPostGeneration.service"
          );

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
          const instagramPost = dynamicPosts.find((p: any) => p.platform === "instagram");
          const facebookPost = dynamicPosts.find((p: any) => p.platform === "facebook");
          const linkedinPost = dynamicPosts.find((p: any) => p.platform === "linkedin");
          const twitterPost = dynamicPosts.find((p: any) => p.platform === "twitter");
          const tiktokPost = dynamicPosts.find((p: any) => p.platform === "tiktok");
          const youtubePost = dynamicPosts.find((p: any) => p.platform === "youtube");
          
          captions = {
            instagram_caption: instagramPost?.content || "",
            facebook_caption: facebookPost?.content || "",
            linkedin_caption: linkedinPost?.content || "",
            twitter_caption: twitterPost?.content || "",
            tiktok_caption: tiktokPost?.content || "",
            youtube_caption: youtubePost?.content || "", // ✅ Ensure youtube_caption is included
          };

        } catch (dynamicError) {
      
          // Fall through to generate fallback captions
          captions = await this.generateFallbackCaptions(
            pendingCaption.topic || title,
            pendingCaption.keyPoints || "",
            pendingCaption.userContext || {
              name: "Real Estate Professional",
              position: "Real Estate Professional",
              companyName: "Real Estate Company",
              city: "Your City",
              socialHandles: "@realestate",
            },
            email
          );
        }
      } else {
    
        captions = await this.generateFallbackCaptions(
          pendingCaption.topic || title,
          pendingCaption.keyPoints || "",
          pendingCaption.userContext || {
            name: "Real Estate Professional",
            position: "Real Estate Professional",
            companyName: "Real Estate Company",
            city: "Your City",
            socialHandles: "@realestate",
          },
          email
        );
      }

 
      
      await PendingCaptions.findOneAndUpdate(
        {
          email: email,
          title: title,
        },
        {
          captions, // ✅ Includes youtube_caption
          dynamicPosts: dynamicPosts.length > 0 ? dynamicPosts : undefined,
          isPending: false, // Mark as completed
        },
        { new: true }
      );

      // Update the video with the generated captions (works even if video is processing)
      try {
   
        await this.videoService.updateVideoCaptions(videoId, captions);
      
      } catch (captionUpdateError) {
    
        // Continue anyway - captions are stored in PendingCaptions
      }

   
    } catch (error: any) {
    

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
          },
          email
        );

        // Try to update video captions, but don't fail if video is still processing
        try {
          await this.videoService.updateVideoCaptions(
            videoId,
            fallbackCaptions
          );
         
        } catch (updateError) {
        
          // Store in PendingCaptions as fallback
          await PendingCaptions.findOneAndUpdate(
            { email: email, title: title },
            { captions: fallbackCaptions, isPending: false, isDynamic: false },
            { upsert: true }
          );
        
        }
      } catch (fallbackError) {
      
      }
    }
  }

  /**
   * Generate fallback captions using traditional method
   */
  private async generateFallbackCaptions(
    topic: string,
    keyPoints: string,
    userContext: any,
    email: string
  ): Promise<any> {
    // Get user settings to retrieve language preference
    const userSettings = await UserVideoSettings.findOne({
      email: email,
    });
    const language = userSettings?.language;

    const { CaptionGenerationService } = await import(
      "./captionGeneration.service"
    );

   
    const captions = await CaptionGenerationService.generateCaptions(
      topic,
      keyPoints,
      userContext,
      language
    );
    
    
    return captions;
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
