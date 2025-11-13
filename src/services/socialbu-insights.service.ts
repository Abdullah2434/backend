import socialBuService from './socialbu.service';
import { SocialBuApiResponse } from '../types';

export interface SocialBuInsight {
  id: number;
  post_id: number;
  account_id: number;
  metric_type: string;
  value: number;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface GetInsightsRequest {
  start: string; // Date in YYYY-MM-DD format
  end: string; // Date in YYYY-MM-DD format
  metrics: string | string[]; // Comma-separated metrics or array
}

// Valid metrics types
export const VALID_METRICS = [
  'like_count',
  'comments_count',
  'impressions',
  'reach',
  'saved',
  'plays',
  'shares',
  'total_interactions'
] as const;

export class SocialBuInsightsService {
  async getTopPosts(
    token: string,
    requestData: GetInsightsRequest
  ): Promise<SocialBuApiResponse<SocialBuInsight[]>> {
    try {
      const authService = new (await import("../services/auth.service")).default();

      const user = await authService.getCurrentUser(token);
      if (!user) {
        return {
          success: false,
          message: "User not found or invalid token",
        };
      }

      // Validate required fields
      if (!requestData.start || !requestData.end || !requestData.metrics) {
        return {
          success: false,
          message: "Missing required fields: start, end, and metrics are required",
        };
      }

      // Validate and prepare request body for SocialBu API
      const requestBody: any = {
        start: requestData.start,
        end: requestData.end
      };
      
      // Handle metrics parameter
      let metricsToProcess: string[] = [];
      
      if (Array.isArray(requestData.metrics)) {
        metricsToProcess = requestData.metrics;
      } else {
        // Split comma-separated string
        metricsToProcess = requestData.metrics.split(',').map(m => m.trim());
      }
      
      // Validate each metric against valid enum values
      const invalidMetrics = metricsToProcess.filter(metric => !VALID_METRICS.includes(metric as any));
      if (invalidMetrics.length > 0) {
        return {
          success: false,
          message: `Invalid metric(s): ${invalidMetrics.join(', ')}. Valid metrics are: ${VALID_METRICS.join(', ')}`,
        };
      }
      
      // Join metrics with comma for SocialBu API
      requestBody.metrics = metricsToProcess.join(',');

      // Get top posts from SocialBu API
      const insightsResult = await socialBuService.makeAuthenticatedRequest(
        'GET',
        '/insights/posts/top_posts',
        requestBody
      );

      if (!insightsResult.success || !insightsResult.data) {
        return {
          success: false,
          message: insightsResult.message || "Failed to get top posts",
          error: insightsResult.error
        };
      }

      // Handle different response structures
      let insightsData = insightsResult.data;
      
      // If the response has an 'items' property (SocialBu API structure), use that
      if (insightsResult.data && typeof insightsResult.data === 'object' && insightsResult.data.items) {
        insightsData = insightsResult.data.items;
      }
      // If the response has a data property, use that
      else if (insightsResult.data && typeof insightsResult.data === 'object' && insightsResult.data.data) {
        insightsData = insightsResult.data.data;
      }
      
      // If insightsData is not an array, wrap it in an array or return empty array
      if (!Array.isArray(insightsData)) {
        insightsData = [];
      }

      // Filter insights that belong to this user's connected accounts
      const userAccountIds = user.socialbu_account_ids || [];
      const userInsights = insightsData.filter((insight: any) =>
        userAccountIds.includes(Number(insight.account_id))
      );

      // Get insights with account details for each insight
      const insightsWithAccountDetails = userInsights.map((insight: any) => {
        // Find matching account ID
        const matchingAccountId = userAccountIds.find((id: number) => id === Number(insight.account_id));
        
        return {
          ...insight,
          userId: user._id.toString(),
          account_details: {
            account_id: insight.account_id,
            is_connected: !!matchingAccountId,
            user_account_id: matchingAccountId
          }
        };
      });

      // Prepare user data for response (excluding sensitive information)
      const userData = {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        socialbu_account_ids: user.socialbu_account_ids || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      // Include pagination info if available
      const responseData: any = {
        user: userData,
        insights: insightsWithAccountDetails,
        total: insightsWithAccountDetails.length,
        date_range: {
          start: requestData.start,
          end: requestData.end
        },
        metrics_requested: Array.isArray(requestData.metrics) 
          ? requestData.metrics 
          : requestData.metrics.split(',').map(m => m.trim())
      };

      // Add pagination info from SocialBu response if available
      if (insightsResult.data && typeof insightsResult.data === 'object') {
        if (insightsResult.data.currentPage) responseData.currentPage = insightsResult.data.currentPage;
        if (insightsResult.data.lastPage) responseData.lastPage = insightsResult.data.lastPage;
        if (insightsResult.data.nextPage) responseData.nextPage = insightsResult.data.nextPage;
        if (insightsResult.data.total) responseData.totalFromSocialBu = insightsResult.data.total;
      }

      return {
        success: true,
        message: "User top posts retrieved successfully",
        data: responseData,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to retrieve user top posts",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const socialBuInsightsService = new SocialBuInsightsService();
