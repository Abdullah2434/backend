import UserPostHistory from "../models/UserPostHistory";

export interface PerformanceMetrics {
  templateVariant: number;
  topicCategory: string;
  toneUsed: string;
  hookType: string;
  ctaType: string;
  platform: string;
  engagementScore?: number;
  reachScore?: number;
  conversionScore?: number;
  timestamp: Date;
}

export interface PerformanceStats {
  topPerformingTemplates: Array<{
    templateVariant: number;
    averageScore: number;
    usageCount: number;
  }>;
  topPerformingTones: Array<{
    toneUsed: string;
    averageScore: number;
    usageCount: number;
  }>;
  topPerformingHooks: Array<{
    hookType: string;
    averageScore: number;
    usageCount: number;
  }>;
  topPerformingCTAs: Array<{
    ctaType: string;
    averageScore: number;
    usageCount: number;
  }>;
  platformPerformance: Array<{
    platform: string;
    averageScore: number;
    usageCount: number;
  }>;
  topicCategoryPerformance: Array<{
    topicCategory: string;
    averageScore: number;
    usageCount: number;
  }>;
}

export class PerformanceTrackingService {
  /**
   * Record performance metrics for a post
   */
  static async recordPerformanceMetrics(
    userId: string,
    platform: string,
    postId: string,
    metrics: Omit<PerformanceMetrics, "timestamp">
  ): Promise<void> {
    try {
      // For now, we'll store performance data in the UserPostHistory model
      // In the future, this could be a separate PerformanceMetrics model
      const postHistory = await UserPostHistory.findOne({
        userId,
        platform,
        postId,
      });

      if (postHistory) {
        // Update with performance metrics
        await UserPostHistory.findByIdAndUpdate(postHistory._id, {
          $set: {
            engagementScore: metrics.engagementScore,
            reachScore: metrics.reachScore,
            conversionScore: metrics.conversionScore,
            performanceRecordedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error("Error recording performance metrics:", error);
    }
  }

  /**
   * Get performance statistics for a user
   */
  static async getUserPerformanceStats(
    userId: string,
    platform?: string,
    daysBack: number = 30
  ): Promise<PerformanceStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const matchQuery: any = {
        userId,
        createdAt: { $gte: startDate },
      };

      if (platform) {
        matchQuery.platform = platform;
      }

      const [
        templateStats,
        toneStats,
        hookStats,
        ctaStats,
        platformStats,
        topicStats,
      ] = await Promise.all([
        // Template performance
        UserPostHistory.aggregate([
          { $match: matchQuery },
          { $match: { engagementScore: { $exists: true } } },
          {
            $group: {
              _id: "$templateVariant",
              averageScore: { $avg: "$engagementScore" },
              usageCount: { $sum: 1 },
            },
          },
          { $sort: { averageScore: -1 } },
          { $limit: 5 },
        ]),

        // Tone performance
        UserPostHistory.aggregate([
          { $match: matchQuery },
          { $match: { engagementScore: { $exists: true } } },
          {
            $group: {
              _id: "$toneUsed",
              averageScore: { $avg: "$engagementScore" },
              usageCount: { $sum: 1 },
            },
          },
          { $sort: { averageScore: -1 } },
          { $limit: 5 },
        ]),

        // Hook performance
        UserPostHistory.aggregate([
          { $match: matchQuery },
          { $match: { engagementScore: { $exists: true } } },
          {
            $group: {
              _id: "$hookType",
              averageScore: { $avg: "$engagementScore" },
              usageCount: { $sum: 1 },
            },
          },
          { $sort: { averageScore: -1 } },
          { $limit: 5 },
        ]),

        // CTA performance
        UserPostHistory.aggregate([
          { $match: matchQuery },
          { $match: { engagementScore: { $exists: true } } },
          {
            $group: {
              _id: "$ctaType",
              averageScore: { $avg: "$engagementScore" },
              usageCount: { $sum: 1 },
            },
          },
          { $sort: { averageScore: -1 } },
          { $limit: 5 },
        ]),

        // Platform performance
        UserPostHistory.aggregate([
          { $match: matchQuery },
          { $match: { engagementScore: { $exists: true } } },
          {
            $group: {
              _id: "$platform",
              averageScore: { $avg: "$engagementScore" },
              usageCount: { $sum: 1 },
            },
          },
          { $sort: { averageScore: -1 } },
        ]),

        // Topic category performance
        UserPostHistory.aggregate([
          { $match: matchQuery },
          { $match: { engagementScore: { $exists: true } } },
          {
            $group: {
              _id: "$topicCategory",
              averageScore: { $avg: "$engagementScore" },
              usageCount: { $sum: 1 },
            },
          },
          { $sort: { averageScore: -1 } },
          { $limit: 5 },
        ]),
      ]);

      return {
        topPerformingTemplates: templateStats.map((stat) => ({
          templateVariant: stat._id,
          averageScore: Math.round(stat.averageScore * 100) / 100,
          usageCount: stat.usageCount,
        })),
        topPerformingTones: toneStats.map((stat) => ({
          toneUsed: stat._id,
          averageScore: Math.round(stat.averageScore * 100) / 100,
          usageCount: stat.usageCount,
        })),
        topPerformingHooks: hookStats.map((stat) => ({
          hookType: stat._id,
          averageScore: Math.round(stat.averageScore * 100) / 100,
          usageCount: stat.usageCount,
        })),
        topPerformingCTAs: ctaStats.map((stat) => ({
          ctaType: stat._id,
          averageScore: Math.round(stat.averageScore * 100) / 100,
          usageCount: stat.usageCount,
        })),
        platformPerformance: platformStats.map((stat) => ({
          platform: stat._id,
          averageScore: Math.round(stat.averageScore * 100) / 100,
          usageCount: stat.usageCount,
        })),
        topicCategoryPerformance: topicStats.map((stat) => ({
          topicCategory: stat._id,
          averageScore: Math.round(stat.averageScore * 100) / 100,
          usageCount: stat.usageCount,
        })),
      };
    } catch (error) {
      console.error("Error getting performance stats:", error);
      throw error;
    }
  }

  /**
   * Get recommendations for optimal content strategy
   */
  static async getContentRecommendations(
    userId: string,
    platform: string
  ): Promise<{
    recommendedTemplate: number;
    recommendedTone: string;
    recommendedHook: string;
    recommendedCTA: string;
    reasoning: string[];
  }> {
    try {
      const stats = await this.getUserPerformanceStats(userId, platform, 30);

      const recommendations = {
        recommendedTemplate:
          stats.topPerformingTemplates[0]?.templateVariant || 1,
        recommendedTone:
          stats.topPerformingTones[0]?.toneUsed || "conversational",
        recommendedHook: stats.topPerformingHooks[0]?.hookType || "question",
        recommendedCTA: stats.topPerformingCTAs[0]?.ctaType || "action",
        reasoning: [] as string[],
      };

      // Build reasoning based on performance data
      if (stats.topPerformingTemplates.length > 0) {
        recommendations.reasoning.push(
          `Template ${recommendations.recommendedTemplate} has the highest engagement (${stats.topPerformingTemplates[0].averageScore})`
        );
      }

      if (stats.topPerformingTones.length > 0) {
        recommendations.reasoning.push(
          `"${recommendations.recommendedTone}" tone performs best with ${stats.topPerformingTones[0].averageScore} average engagement`
        );
      }

      if (stats.topPerformingHooks.length > 0) {
        recommendations.reasoning.push(
          `"${recommendations.recommendedHook}" hooks generate the most engagement`
        );
      }

      if (stats.topPerformingCTAs.length > 0) {
        recommendations.reasoning.push(
          `"${recommendations.recommendedCTA}" CTAs drive the most action`
        );
      }

      return recommendations;
    } catch (error) {
      console.error("Error getting content recommendations:", error);
      throw error;
    }
  }

  /**
   * Update post history with engagement data from social media platforms
   */
  static async updatePostEngagement(
    userId: string,
    platform: string,
    postId: string,
    engagementData: {
      likes?: number;
      comments?: number;
      shares?: number;
      views?: number;
      clicks?: number;
    }
  ): Promise<void> {
    try {
      // Calculate engagement score based on platform-specific metrics
      let engagementScore = 0;

      switch (platform) {
        case "instagram":
          engagementScore =
            (engagementData.likes || 0) * 1 +
            (engagementData.comments || 0) * 3 +
            (engagementData.shares || 0) * 2;
          break;
        case "facebook":
          engagementScore =
            (engagementData.likes || 0) * 1 +
            (engagementData.comments || 0) * 2 +
            (engagementData.shares || 0) * 3;
          break;
        case "linkedin":
          engagementScore =
            (engagementData.likes || 0) * 1 +
            (engagementData.comments || 0) * 4 +
            (engagementData.shares || 0) * 3;
          break;
        case "tiktok":
          engagementScore =
            (engagementData.likes || 0) * 1 +
            (engagementData.comments || 0) * 2 +
            (engagementData.shares || 0) * 2 +
            (engagementData.views || 0) * 0.1;
          break;
        case "youtube":
          engagementScore =
            (engagementData.likes || 0) * 1 +
            (engagementData.comments || 0) * 2 +
            (engagementData.shares || 0) * 2 +
            (engagementData.views || 0) * 0.05;
          break;
        default:
          engagementScore =
            (engagementData.likes || 0) +
            (engagementData.comments || 0) * 2 +
            (engagementData.shares || 0) * 2;
      }

      await this.recordPerformanceMetrics(userId, platform, postId, {
        templateVariant: 1, // Will be updated when we have the actual data
        topicCategory: "general",
        toneUsed: "conversational",
        hookType: "question",
        ctaType: "action",
        platform,
        engagementScore,
        reachScore: engagementData.views || 0,
        conversionScore: engagementData.clicks || 0,
      });

      console.log(
        `📊 Updated engagement for ${platform} post ${postId}: ${engagementScore} score`
      );
    } catch (error) {
      console.error("Error updating post engagement:", error);
    }
  }
}

export default PerformanceTrackingService;

