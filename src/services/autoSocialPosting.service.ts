import UserConnectedAccount from "../models/UserConnectedAccount";
import VideoSchedule from "../models/VideoSchedule";
import socialBuService from "./socialbu.service";
import socialBuMediaService from "./socialbu-media.service";
import { notificationService } from "./notification.service";
import SocialBuToken from "../models/SocialBuToken";
import dynamicContentGenerationService from "./dynamicContentGeneration.service";
import User from "../models/User";

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
      console.log(
        `🚀 Starting auto social media posting for user ${data.userId}, schedule ${data.scheduleId}, trend ${data.trendIndex}`
      );

      // Preflight: ensure active SocialBu token exists
      const activeToken = await SocialBuToken.findOne({ isActive: true });
      if (!activeToken || !activeToken.authToken) {
        console.warn("⚠️ No active SocialBu token found. Skipping auto-post.");
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
        console.log(
          `⚠️ No connected social media accounts found for user ${data.userId}`
        );
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

      console.log(
        `📱 Found ${connectedAccounts.length} connected accounts for user ${data.userId}`
      );

      // Log connected accounts details
      console.log("📋 Connected social media accounts:");
      connectedAccounts.forEach((account, index) => {
        console.log(
          `  ${index + 1}. ${account.accountName} (${account.accountType})`
        );
        console.log(`     📋 Account ID: ${account.socialbuAccountId}`);
        console.log(`     📋 Active: ${account.isActive}`);
        console.log(`     📋 Max Length: ${account.postMaxlength} characters`);
      });

      // Step 1: Upload video using existing manual upload function
      console.log(
        "📤 Uploading video using existing manual upload function..."
      );
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

      console.log("✅ Video uploaded successfully to SocialBu");

      // Step 1.1: Fetch upload_token from SocialBu using the key (align with manual flow)
      const key = socialbuResponse.key;
      console.log("🔑 SocialBu upload key:", key);
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
      console.log("🔐 SocialBu upload_token:", uploadToken);

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
          console.log(
            `📝 Posting to ${account.accountName} (${account.accountType})`
          );

          // Generate dynamic caption for this platform
          const caption = await this.getPlatformCaption(
            account.accountType,
            trend,
            data.userId,
            data.videoTitle,
            trend.description || data.videoTitle
          );
          console.log(
            `📋 Generated dynamic caption for ${account.accountType}:`
          );
          console.log(
            `📋 Caption preview: ${
              caption
                ? caption.substring(0, 100) + "..."
                : "No caption available"
            }`
          );

          const result = await this.postToPlatform(
            account,
            trend,
            uploadToken,
            data.userId,
            data.videoTitle,
            trend.description || data.videoTitle
          );

          results.push(result);

          if (result.success) {
            console.log(`✅ Successfully posted to ${account.accountName}`);
          } else {
            console.log(
              `❌ Failed to post to ${account.accountName}: ${result.error}`
            );
          }
        } catch (error: any) {
          console.error(`❌ Error posting to ${account.accountName}:`, error);
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

      console.log(
        `🎉 Auto social media posting completed. ${successfulPosts.length}/${results.length} posts successful`
      );

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
    uploadToken: string,
    userId: string,
    videoTitle: string,
    videoDescription: string
  ): Promise<SocialPostResult> {
    try {
      // Get the appropriate caption for this platform (same logic as manual posting)
      const caption = await this.getPlatformCaption(
        account.accountType,
        trend,
        userId,
        videoTitle,
        videoDescription
      );

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
        console.log(`🕒 Using publish_at (UTC): ${publishAt}`);
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
        console.log(
          `📦 SocialBu post body for ${account.accountName} (${account.accountType}):\n` +
            JSON.stringify(postData, null, 2)
        );
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
      console.error(`❌ Error posting to ${account.accountName}:`, error);
      return {
        platform: account.accountType,
        accountName: account.accountName,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get the appropriate caption for a platform using dynamic content generation
   * This replaces static captions with intelligent, anti-repetitive content
   */
  private async getPlatformCaption(
    accountType: string,
    trend: any,
    userId: string,
    videoTitle: string,
    videoDescription: string
  ): Promise<string | null> {
    try {
      // Map account types to platform names
      const platformMap: { [key: string]: string } = {
        "instagram.api": "instagram",
        "facebook.profile": "facebook",
        "linkedin.profile": "linkedin",
        "twitter.profile": "tiktok", // Twitter maps to TikTok for content style
        "tiktok.profile": "tiktok",
        "google.youtube": "youtube",
      };

      const platform = platformMap[accountType];
      if (!platform) {
        console.warn(
          `Unknown platform type: ${accountType}, falling back to static caption`
        );
        return this.getStaticCaption(accountType, trend);
      }

      // Get user information for dynamic content generation
      const user = await User.findById(userId);
      if (!user) {
        console.warn(
          `User not found: ${userId}, falling back to static caption`
        );
        return this.getStaticCaption(accountType, trend);
      }

      // Determine topic type based on video content
      const topicType = this.classifyTopic(videoTitle, videoDescription);

      // Generate dynamic content
      const generatedContent =
        await dynamicContentGenerationService.generateContent({
          userId,
          platform,
          topicType,
          videoTitle,
          videoDescription,
          agentInfo: {
            name: user.firstName + " " + user.lastName,
            location: user.location || "Your Area",
            specialty: user.specialty || "Real Estate Professional",
          },
        });

      console.log(`🎯 Generated dynamic content for ${platform}:`);
      console.log(`   Template: ${generatedContent.templateUsed}`);
      console.log(`   Hook: ${generatedContent.hookType}`);
      console.log(`   Tone: ${generatedContent.toneStyle}`);
      console.log(`   CTA: ${generatedContent.ctaType}`);

      return generatedContent.content;
    } catch (error) {
      console.error(
        `❌ Error generating dynamic content for ${accountType}:`,
        error
      );
      console.log("🔄 Falling back to static caption");
      return this.getStaticCaption(accountType, trend);
    }
  }

  /**
   * Fallback to static captions if dynamic generation fails
   */
  private getStaticCaption(accountType: string, trend: any): string | null {
    switch (accountType) {
      case "instagram.api":
        return trend.instagram_caption || null;
      case "facebook.profile":
        return trend.facebook_caption || null;
      case "linkedin.profile":
        return trend.linkedin_caption || null;
      case "twitter.profile":
        return trend.twitter_caption || null;
      case "tiktok.profile":
        return trend.tiktok_caption || null;
      case "google.youtube":
        return trend.youtube_caption || null;
      default:
        console.warn(`Unknown platform type: ${accountType}`);
        return null;
    }
  }

  /**
   * Classify topic type based on video content
   */
  private classifyTopic(videoTitle: string, videoDescription: string): string {
    const content = (videoTitle + " " + videoDescription).toLowerCase();

    // Market update indicators
    if (
      content.includes("market") ||
      content.includes("rates") ||
      content.includes("prices") ||
      content.includes("trend") ||
      content.includes("data") ||
      content.includes("report")
    ) {
      return "market_update";
    }

    // Tips indicators
    if (
      content.includes("tip") ||
      content.includes("advice") ||
      content.includes("guide") ||
      content.includes("how to") ||
      content.includes("steps") ||
      content.includes("help")
    ) {
      return "tips";
    }

    // Local news indicators
    if (
      content.includes("local") ||
      content.includes("neighborhood") ||
      content.includes("area") ||
      content.includes("community") ||
      content.includes("city") ||
      content.includes("region")
    ) {
      return "local_news";
    }

    // Industry analysis indicators
    if (
      content.includes("analysis") ||
      content.includes("industry") ||
      content.includes("professional") ||
      content.includes("expert") ||
      content.includes("insight") ||
      content.includes("research")
    ) {
      return "industry_analysis";
    }

    // Default to general
    return "general";
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
