import socialBuService from './socialbu.service';
import { SocialBuApiResponse } from '../../types';

export interface SocialBuPost {
  id: number;
  content: string;
  type: string;
  status: string;
  scheduled_at?: string;
  published_at?: string;
  account_id: number;
  media_urls?: string[];
  created_at: string;
  updated_at: string;
}

export interface GetPostsRequest {
  type?: string | string[]; // Support both single string and array of strings
  account_id?: number;
  limit?: number;
  offset?: number;
}

// Valid post types enum
export const VALID_POST_TYPES = [
  'awaiting_approval',
  'draft', 
  'published',
  'scheduled',
  'scheduled_or_awaiting_approval'
] as const;

export class SocialBuPostsService {
  async getUserPosts(
    token: string,
    requestData: GetPostsRequest = {}
  ): Promise<SocialBuApiResponse<SocialBuPost[]>> {
    try {
      const authService = new (await import("../../services/auth.service")).default();

      const user = await authService.getCurrentUser(token);
      if (!user) {
        return {
          success: false,
          message: "User not found or invalid token",
        };
      }

      // Validate and prepare request body for SocialBu API
      const requestBody: any = {};
      
      if (requestData.type) {
        // Handle both single string and array of strings
        let typesToProcess: string[] = [];
        
        if (Array.isArray(requestData.type)) {
          typesToProcess = requestData.type;
        } else {
          typesToProcess = [requestData.type];
        }
        
        // Validate each type against valid enum values
        const invalidTypes = typesToProcess.filter(type => !VALID_POST_TYPES.includes(type as any));
        if (invalidTypes.length > 0) {
          return {
            success: false,
            message: `Invalid post type(s): ${invalidTypes.join(', ')}. Valid types are: ${VALID_POST_TYPES.join(', ')}`,
          };
        }
        
        // If multiple types, join them with comma (SocialBu API format)
        requestBody.type = typesToProcess.join(',');
      }
      
      if (requestData.account_id) {
        requestBody.account_id = requestData.account_id;
      }
      
      if (requestData.limit) {
        requestBody.limit = requestData.limit;
      }
      
      if (requestData.offset) {
        requestBody.offset = requestData.offset;
      }

      // Get posts from SocialBu API
      const postsResult = await socialBuService.makeAuthenticatedRequest(
        'GET',
        '/posts',
        requestBody
      );

      if (!postsResult.success || !postsResult.data) {
        return {
          success: false,
          message: postsResult.message || "Failed to get posts",
          error: postsResult.error
        };
      }

      // Handle different response structures
      let postsData = postsResult.data;
      
      // If the response has an 'items' property (SocialBu API structure), use that
      if (postsResult.data && typeof postsResult.data === 'object' && postsResult.data.items) {
        postsData = postsResult.data.items;
       
      }
      // If the response has a data property, use that
      else if (postsResult.data && typeof postsResult.data === 'object' && postsResult.data.data) {
        postsData = postsResult.data.data;
   
      }
      
      // If postsData is not an array, wrap it in an array or return empty array
      if (!Array.isArray(postsData)) {

        postsData = [];
      }

      // Filter posts that belong to this user's connected accounts
      const userAccountIds = user.socialbu_account_ids || [];
      const userPosts = postsData.filter((post: any) =>
        userAccountIds.includes(Number(post.account_id))
      );

      // Get account details for each post by matching account_id with user's socialbu_account_ids
      const postsWithAccountDetails = userPosts.map((post: any) => {
        // Find matching account ID
        const matchingAccountId = userAccountIds.find((id: number) => id === Number(post.account_id));
        
        return {
          ...post,
          userId: user._id.toString(),
          account_details: {
            account_id: post.account_id,
            account_type: post.account_type,
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
        posts: postsWithAccountDetails,
        total: postsWithAccountDetails.length
      };

      // Add pagination info from SocialBu response if available
      if (postsResult.data && typeof postsResult.data === 'object') {
        if (postsResult.data.currentPage) responseData.currentPage = postsResult.data.currentPage;
        if (postsResult.data.lastPage) responseData.lastPage = postsResult.data.lastPage;
        if (postsResult.data.nextPage) responseData.nextPage = postsResult.data.nextPage;
        if (postsResult.data.total) responseData.totalFromSocialBu = postsResult.data.total;
      }

      return {
        success: true,
        message: "User data and posts retrieved successfully",
        data: responseData,
      };
    } catch (error) {

      return {
        success: false,
        message: "Failed to retrieve user posts",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const socialBuPostsService = new SocialBuPostsService();
