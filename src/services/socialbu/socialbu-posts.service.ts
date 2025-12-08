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
  ): Promise<SocialBuApiResponse<any>> {
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

      // Build base request body for SocialBu API (without page)
      const baseRequestBody = buildPostsRequestBody(requestData);
      
      // Fetch first page to get pagination info
      console.log('=== Fetching Posts - Page 1 ===');
      const firstPageResult = await socialBuService.makeAuthenticatedRequest(
        'GET',
        POSTS_ENDPOINT,
        { ...baseRequestBody, page: 1 }
      );
      
      console.log('First page result:', {
        success: firstPageResult.success,
        hasData: !!firstPageResult.data,
      });

      if (!firstPageResult.success || !firstPageResult.data) {
        return {
          success: false,
          message: firstPageResult.message || ERROR_MESSAGES.FAILED_TO_GET_POSTS,
          error: firstPageResult.error
        };
      }

      // Extract pagination info from first page
      const firstPageData = firstPageResult.data;
      const lastPage = firstPageData?.lastPage || 1;
      const currentPage = firstPageData?.currentPage || 1;
      const totalFromSocialBu = firstPageData?.total || 0;

      console.log('Pagination Info:', {
        currentPage,
        lastPage,
        totalFromSocialBu,
      });

      // Extract posts from first page
      let allPosts = extractPostsData(firstPageData);
      console.log(`Page 1: Fetched ${allPosts.length} posts`);

      // Fetch remaining pages if there are more
      if (lastPage > 1) {
        console.log(`=== Fetching remaining pages (2 to ${lastPage}) ===`);
        const pagePromises: Promise<any>[] = [];

        // Fetch all remaining pages in parallel
        for (let page = 2; page <= lastPage; page++) {
          pagePromises.push(
            socialBuService.makeAuthenticatedRequest(
              'GET',
              POSTS_ENDPOINT,
              { ...baseRequestBody, page }
            ).then((result) => {
              if (result.success && result.data) {
                const pagePosts = extractPostsData(result.data);
                console.log(`Page ${page}: Fetched ${pagePosts.length} posts`);
                return pagePosts;
              }
              console.warn(`Page ${page}: Failed to fetch - ${result.message}`);
              return [];
            }).catch((error) => {
              console.error(`Page ${page}: Error -`, error.message);
              return [];
            })
          );
        }

        // Wait for all pages to be fetched
        const remainingPagesResults = await Promise.all(pagePromises);
        
        // Combine all posts from all pages
        remainingPagesResults.forEach((pagePosts, index) => {
          allPosts = [...allPosts, ...pagePosts];
        });

        console.log(`=== All Pages Fetched ===`);
        console.log(`Total posts from all pages: ${allPosts.length}`);
      }

      // Filter posts that belong to this user's connected accounts
      const userAccountIds = user.socialbu_account_ids || [];
      console.log('User Account IDs:', userAccountIds);
      console.log('Filtering posts by user account IDs...');
      
      const userPosts = allPosts.filter((post: any) =>
        userAccountIds.includes(Number(post.account_id))
      );

      console.log(`Filtered posts: ${userPosts.length} out of ${allPosts.length} total posts`);

      // Add account details to posts
      const postsWithAccountDetails = addAccountDetailsToPosts(
        userPosts,
        userAccountIds,
        user._id.toString()
      );

      // Prepare user data for response
      const userData = buildUserDataForResponse(user);

      // Build response data with aggregated pagination info
      const responseData = {
        user: userData,
        posts: postsWithAccountDetails,
        total: postsWithAccountDetails.length,
        currentPage: 1, // Since we aggregated all pages, show as page 1
        lastPage: 1, // Since we aggregated all pages, show as single page
        nextPage: null, // No next page since we fetched all
        totalFromSocialBu: totalFromSocialBu, // Total from SocialBu API
        pagesFetched: lastPage, // Number of pages we actually fetched
        totalPostsBeforeFilter: allPosts.length, // Total posts before filtering by user accounts
      };

      console.log('=== Final Response ===');
      console.log(`Total filtered posts: ${responseData.total}`);
      console.log(`Pages fetched: ${responseData.pagesFetched}`);

      return {
        success: true,
        message: SUCCESS_MESSAGES.USER_DATA_RETRIEVED,
        data: responseData,
      };
    } catch (error) {
      console.error('=== Error in getUserPosts ===');
      console.error('Error:', error);
      return {
        success: false,
        message: ERROR_MESSAGES.FAILED_TO_RETRIEVE_USER_POSTS,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }
}

export const socialBuPostsService = new SocialBuPostsService();
