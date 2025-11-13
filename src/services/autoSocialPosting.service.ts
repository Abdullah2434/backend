import UserConnectedAccount from "../models/UserConnectedAccount";
import VideoSchedule from "../models/VideoSchedule";
import socialBuService from "./socialbu.service";
import socialBuMediaService from "./socialbu-media.service";
import { notificationService } from "./notification.service";
import SocialBuToken from "../models/SocialBuToken";

export interface AutoPostingData {
  userId: string;
  scheduleId: string;
  trendIndex: number;
  videoUrl: string;
  videoTitle: string;
}

export interface SocialPostResult {
  platform: string;
  accountName: string;
  success: boolean;
  postId?: string;
  error?: string;
}

export class AutoSocialPostingService {
  /**
   * Automatically post video to connected social media accounts
   * Reuses existing manual posting functions to ensure consistency
   */
  async postVideoToSocialMedia(
    data: AutoPostingData
  ): Promise<SocialPostResult[]> {
    try {
   
      // Preflight: ensure active SocialBu token exists
      const activeToken = await SocialBuToken.findOne({ isActive: true });
      if (!activeToken || !activeToken.authToken) {
        notificationService.notifyAutoPostAlert(data.userId, "failure", {
          scheduleId: data.scheduleId,
          trendIndex: data.trendIndex,
          videoTitle: data.videoTitle,
          errorDetails: "No active SocialBu token configured",
          totalPlatforms: 0,
          failureCount: 0,
        });
        return [];
      }

      // Get the video schedule and specific trend
      const schedule = await VideoSchedule.findById(data.scheduleId);
      if (!schedule) {
        throw new Error("Video schedule not found");
      }

      const trend = schedule.generatedTrends[data.trendIndex];
      if (!trend) {
        throw new Error("Trend not found in schedule");
      }

      // Get user's connected social media accounts
      const connectedAccounts = await UserConnectedAccount.find({
        userId: data.userId,
        isActive: true,
      });

      if (connectedAccounts.length === 0) {
    
        notificationService.notifyAutoPostAlert(data.userId, "failure", {
          scheduleId: data.scheduleId,
          trendIndex: data.trendIndex,
          videoTitle: data.videoTitle,
          errorDetails: "No connected social media accounts",
          totalPlatforms: 0,
          failureCount: 0,
        });
        return [];
      }

     

      connectedAccounts.forEach((account, index) => {
       
      });

  
      const uploadResult = await socialBuMediaService.uploadMedia(data.userId, {
        name: data.videoTitle.replace(/[^a-zA-Z0-9]/g, "_") + ".mp4",
        mime_type: "video/mp4",
        videoUrl: data.videoUrl,
      });

      if (!uploadResult.success) {
        throw new Error(
          `Failed to upload video to SocialBu: ${uploadResult.message}`
        );
      }

      // Extract upload key from the result (same as manual posting)
      const socialbuResponse = uploadResult.data?.socialbuResponse;
      if (!socialbuResponse || !socialbuResponse.key) {
        throw new Error("Failed to get upload key from SocialBu response");
      }

 

      // Step 1.1: Fetch upload_token from SocialBu using the key (align with manual flow)
      const key = socialbuResponse.key;

      // Wait briefly then check status to obtain upload_token
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await socialBuService.makeAuthenticatedRequest(
        "GET",
        `/upload_media/status?key=${encodeURIComponent(key)}`
      );
      if (!statusResponse.success) {
        throw new Error(
          `Failed to check upload status: ${
            statusResponse.message || "unknown error"
          }`
        );
      }
      const uploadToken = statusResponse.data?.upload_token;
      if (!uploadToken) {
        throw new Error("Missing upload_token in SocialBu status response");
      }


      // Send socket notification - Video uploaded
      notificationService.notifyAutoPostProgress(
        data.userId,
        "video-upload",
        "success",
        {
          message: "Video uploaded successfully to SocialBu",
          scheduleId: data.scheduleId,
          trendIndex: data.trendIndex,
          videoTitle: data.videoTitle,
        }
      );

      // Step 2: Post to each connected platform using existing manual posting logic
      const results: SocialPostResult[] = [];

      for (const account of connectedAccounts) {
        try {
     

          // Show which caption will be used for this platform
          const caption = this.getPlatformCaption(account.accountType, trend);
      

          const result = await this.postToPlatform(account, trend, uploadToken);

          results.push(result);

          if (result.success) {
   
          } else {
            console.log(
              `❌ Failed to post to ${account.accountName}: ${result.error}`
            );
          }
        } catch (error: any) {

          results.push({
            platform: account.accountType,
            accountName: account.accountName,
            success: false,
            error: error.message,
          });
        }
      }

      const successfulPosts = results.filter((r) => r.success);
      const failedPosts = results.filter((r) => !r.success);


      // Send enhanced alert notifications based on results
      if (successfulPosts.length === results.length) {
        // All platforms successful
        notificationService.notifyAutoPostAlert(data.userId, "success", {
          scheduleId: data.scheduleId,
          trendIndex: data.trendIndex,
          videoTitle: data.videoTitle,
          successfulPlatforms: successfulPosts.map((r) => r.accountName),
          totalPlatforms: results.length,
          successCount: successfulPosts.length,
        });
      } else if (successfulPosts.length === 0) {
        // All platforms failed
        notificationService.notifyAutoPostAlert(data.userId, "failure", {
          scheduleId: data.scheduleId,
          trendIndex: data.trendIndex,
          videoTitle: data.videoTitle,
          failedPlatforms: failedPosts.map((r) => r.accountName),
          errorDetails: failedPosts.map((r) => r.error).join(", "),
          totalPlatforms: results.length,
          failureCount: failedPosts.length,
        });
      } else {
        // Partial success
        notificationService.notifyAutoPostAlert(data.userId, "partial", {
          scheduleId: data.scheduleId,
          trendIndex: data.trendIndex,
          videoTitle: data.videoTitle,
          successfulPlatforms: successfulPosts.map((r) => r.accountName),
          failedPlatforms: failedPosts.map((r) => r.accountName),
          totalPlatforms: results.length,
          successCount: successfulPosts.length,
          failureCount: failedPosts.length,
        });
      }

      // Also send detailed progress notifications
      if (successfulPosts.length > 0) {
        notificationService.notifyAutoPostProgress(
          data.userId,
          "social-posting",
          "success",
          {
            message: `Successfully posted to ${successfulPosts.length} platforms`,
            scheduleId: data.scheduleId,
            trendIndex: data.trendIndex,
            videoTitle: data.videoTitle,
            successfulPlatforms: successfulPosts.map((r) => r.accountName),
            failedPlatforms: failedPosts.map((r) => r.accountName),
          }
        );
      }

      if (failedPosts.length > 0) {
        notificationService.notifyAutoPostProgress(
          data.userId,
          "social-posting",
          "error",
          {
            message: `Failed to post to ${failedPosts.length} platforms`,
            scheduleId: data.scheduleId,
            trendIndex: data.trendIndex,
            videoTitle: data.videoTitle,
            failedPlatforms: failedPosts.map(
              (r) => `${r.accountName} (${r.error})`
            ),
            successfulPlatforms: successfulPosts.map((r) => r.accountName),
          }
        );
      }

      return results;
    } catch (error: any) {
      console.error("❌ Error in auto social media posting:", error);
      throw error;
    }
  }

  /**
   * Post to a specific platform using existing manual posting logic
   * Reuses the same code path as manual posting for consistency
   */
  private async postToPlatform(
    account: any,
    trend: any,
    uploadToken: string
  ): Promise<SocialPostResult> {
    try {
      // Get the appropriate caption for this platform (same logic as manual posting)
      const caption = this.getPlatformCaption(account.accountType, trend);

      if (!caption) {
        return {
          platform: account.accountType,
          accountName: account.accountName,
          success: false,
          error: `No caption available for platform ${account.accountType}`,
        };
      }

      // Create post data using same structure as manual posting
      // Use UTC from schedule.scheduledFor; format as YYYY-MM-DD HH:mm:00 in UTC
      const formatDateTimeUTC = (d: Date) => {
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
          d.getUTCDate()
        )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
      };
      const publishDate = trend?.scheduledFor
        ? new Date(trend.scheduledFor)
        : new Date();
      const publishAt = formatDateTimeUTC(publishDate);
      try {

      } catch {}
      const postData = {
        accounts: [account.socialbuAccountId], // Use socialbuAccountId like manual posting
        publish_at: publishAt, // Schedule using UTC time from DB
        content: caption,
        existing_attachments: [
          {
            upload_token: uploadToken, // Use upload_token as in manual posting
            type: "video",
          },
        ],
      } as any;

      // Debug: Log full SocialBu post body
      try {
     
      } catch {}

      // Use existing socialBuService.makeAuthenticatedRequest (same as manual posting)
      const postResponse = await socialBuService.makeAuthenticatedRequest(
        "POST",
        "/posts",
        postData
      );

      if (postResponse.success) {
        return {
          platform: account.accountType,
          accountName: account.accountName,
          success: true,
          postId: postResponse.data?.id?.toString(),
        };
      } else {
        return {
          platform: account.accountType,
          accountName: account.accountName,
          success: false,
          error: postResponse.message || "Unknown error",
        };
      }
    } catch (error: any) {
      return {
        platform: account.accountType,
        accountName: account.accountName,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get the appropriate caption for a platform
   * Uses same logic as manual posting for consistency
   */
  private getPlatformCaption(accountType: string, trend: any): string | null {
    // Normalize account type for comparison
    const normalizedType = accountType?.toLowerCase().trim();

    // Instagram
    if (normalizedType === "instagram.api") {
      return trend.instagram_caption || null;
    }
    if (
      normalizedType === "facebook.profile" ||
      normalizedType === "facebook.page" ||
      normalizedType?.startsWith("facebook.")
    ) {
      return trend.facebook_caption || null;
    }

    // LinkedIn
    if (normalizedType === "linkedin.profile") {
      return trend.linkedin_caption || null;
    }

    // Twitter
    if (normalizedType === "twitter.profile") {
      return trend.twitter_caption || null;
    }
    if (normalizedType === "tiktok.profile") {
      return trend.tiktok_caption || null;
    }
    if (normalizedType === "google.youtube") {
      return trend.youtube_caption || null;
    }


    return null;
  }

  /**
   * Get user's connected accounts summary
   */
  async getUserConnectedAccountsSummary(userId: string): Promise<{
    totalAccounts: number;
    platforms: string[];
    accounts: Array<{
      name: string;
      type: string;
      isActive: boolean;
    }>;
  }> {
    const accounts = await UserConnectedAccount.find({
      userId,
      isActive: true,
    });

    return {
      totalAccounts: accounts.length,
      platforms: [...new Set(accounts.map((acc) => acc.accountType))],
      accounts: accounts.map((acc) => ({
        name: acc.accountName,
        type: acc.accountType,
        isActive: acc.isActive,
      })),
    };
  }
}

export default AutoSocialPostingService;
