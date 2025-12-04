import socialBuService from './socialbu.service';
import { SocialBuApiResponse } from '../../types';
import { POSTS_ENDPOINT, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/socialbuService.constants';
import { SocialBuPost, GetPostsRequest } from '../../types/socialbuService.types';
import {
  buildPostsRequestBody,
  extractPostsData,
  addAccountDetailsToPosts,
  buildUserDataForResponse,
  buildUserPostsResponseData,
} from '../../utils/socialbuServiceHelpers';

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
          message: ERROR_MESSAGES.USER_NOT_FOUND,
        };
      }

      // Validate post types if provided
      if (requestData.type) {
        const typesToProcess = Array.isArray(requestData.type)
          ? requestData.type
          : [requestData.type];
        
        const invalidTypes = typesToProcess.filter(
          (type) => !VALID_POST_TYPES.includes(type as any)
        );
        
        if (invalidTypes.length > 0) {
          return {
            success: false,
            message: `Invalid post type(s): ${invalidTypes.join(', ')}. Valid types are: ${VALID_POST_TYPES.join(', ')}`,
          };
        }
      }

      // Build request body for SocialBu API
      const requestBody = buildPostsRequestBody(requestData);

      // Get posts from SocialBu API
      const postsResult = await socialBuService.makeAuthenticatedRequest(
        'GET',
        POSTS_ENDPOINT,
        requestBody
      );

      if (!postsResult.success || !postsResult.data) {
        return {
          success: false,
          message: postsResult.message || ERROR_MESSAGES.FAILED_TO_GET_POSTS,
          error: postsResult.error
        };
      }

      // Extract posts data from API response
      const postsData = extractPostsData(postsResult.data);

      // Filter posts that belong to this user's connected accounts
      const userAccountIds = user.socialbu_account_ids || [];
      const userPosts = postsData.filter((post: any) =>
        userAccountIds.includes(Number(post.account_id))
      );

      // Add account details to posts
      const postsWithAccountDetails = addAccountDetailsToPosts(
        userPosts,
        userAccountIds,
        user._id.toString()
      );

      // Prepare user data for response
      const userData = buildUserDataForResponse(user);

      // Build response data with pagination info
      const responseData = buildUserPostsResponseData(
        userData,
        postsWithAccountDetails,
        postsResult.data
      );

      return {
        success: true,
        message: SUCCESS_MESSAGES.USER_DATA_RETRIEVED,
        data: responseData,
      };
    } catch (error) {

      return {
        success: false,
        message: ERROR_MESSAGES.FAILED_TO_RETRIEVE_USER_POSTS,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }
}

export const socialBuPostsService = new SocialBuPostsService();
