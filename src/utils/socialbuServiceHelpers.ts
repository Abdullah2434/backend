/**
 * Helper functions for SocialBu services
 */

import axios, { AxiosError, AxiosResponse } from "axios";
import https from "https";
import http from "http";
import SocialBuToken, { ISocialBuToken } from "../models/SocialBuToken";
import { connectMongo } from "../config/mongoose";
import {
  SOCIALBU_AUTH_URL,
  SOCIALBU_EMAIL,
  SOCIALBU_PASSWORD,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_OK,
  ERROR_MESSAGES,
  DEFAULT_HEADERS,
  AUTH_ERROR_KEYWORDS,
  DEFAULT_VIDEO_URL,
  POST_DATA_PROPERTIES,
  DEFAULT_PAGE,
  DEFAULT_TOTAL,
} from "../constants/socialbuService.constants";
import {
  SocialBuLoginResponse,
  SocialBuApiResponse,
  FilteredPostsResponse,
} from "../types/socialbuService.types";

// ==================== TOKEN MANAGEMENT HELPERS ====================
/**
 * Get new token from SocialBu API
 */
export async function getNewTokenFromAPI(): Promise<SocialBuLoginResponse | null> {
  if (!SOCIALBU_EMAIL || !SOCIALBU_PASSWORD) {
    return null;
  }

  const response = await axios.post<SocialBuLoginResponse>(
    SOCIALBU_AUTH_URL,
    {
      email: SOCIALBU_EMAIL,
      password: SOCIALBU_PASSWORD,
    },
    {
      headers: DEFAULT_HEADERS,
    }
  );

  return response.data?.authToken ? response.data : null;
}

/**
 * Update existing token with new data
 */
export async function updateExistingToken(
  existingToken: ISocialBuToken,
  tokenData: SocialBuLoginResponse
): Promise<ISocialBuToken> {
  existingToken.authToken = tokenData.authToken;
  existingToken.id = tokenData.id;
  existingToken.name = tokenData.name;
  existingToken.email = tokenData.email;
  existingToken.verified = tokenData.verified;
  existingToken.isActive = true;
  existingToken.lastUsed = new Date();
  existingToken.updatedAt = new Date();

  await existingToken.save();
  return existingToken;
}

/**
 * Create new token record
 */
export async function createNewTokenRecord(
  tokenData: SocialBuLoginResponse
): Promise<ISocialBuToken> {
  const newToken = new SocialBuToken({
    authToken: tokenData.authToken,
    id: tokenData.id,
    name: tokenData.name,
    email: tokenData.email,
    verified: tokenData.verified,
    isActive: true,
    lastUsed: new Date(),
  });

  await newToken.save();
  return newToken;
}

/**
 * Save or update token in database
 */
export async function saveOrUpdateToken(
  tokenData: SocialBuLoginResponse
): Promise<ISocialBuToken | null> {
  try {
    await connectMongo();

    const existingToken = await SocialBuToken.findOne({ isActive: true });

    if (existingToken) {
      return await updateExistingToken(existingToken, tokenData);
    } else {
      return await createNewTokenRecord(tokenData);
    }
  } catch (error) {
    return null;
  }
}

// ==================== AUTHENTICATION HELPERS ====================
/**
 * Check if error is authentication-related
 */
export function isAuthenticationError(
  message?: string,
  statusCode?: number
): boolean {
  if (statusCode === HTTP_STATUS_UNAUTHORIZED || statusCode === HTTP_STATUS_FORBIDDEN) {
    return true;
  }

  if (message) {
    return AUTH_ERROR_KEYWORDS.some((keyword) =>
      message.includes(keyword)
    );
  }

  return false;
}

/**
 * Extract error message from Axios error
 */
export function extractAxiosErrorMessage(error: AxiosError): {
  message: string;
  error: string;
} {
  const responseData = error.response?.data as any;
  const message =
    responseData?.message || error.message || ERROR_MESSAGES.UNKNOWN_ERROR;
  const errorMsg =
    responseData?.message ||
    responseData?.error ||
    (typeof responseData === "string" ? responseData : null) ||
    ERROR_MESSAGES.UNKNOWN_ERROR;

  return { message, error: errorMsg };
}

/**
 * Build authenticated request headers
 */
export function buildAuthHeaders(token: string): Record<string, string> {
  return {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

// ==================== POST FILTERING HELPERS ====================
/**
 * Extract posts data from API response
 */
export function extractPostsData(responseData: any): any[] {
  // If the response has an 'items' property (SocialBu API structure), use that
  if (responseData && typeof responseData === "object" && responseData.items) {
    return responseData.items;
  }
  // If the response has a data property, use that
  if (responseData && typeof responseData === "object" && responseData.data) {
    return responseData.data;
  }
  // If responseData is not an array, return empty array
  if (!Array.isArray(responseData)) {
    return [];
  }
  return responseData;
}

/**
 * Normalize account IDs to numbers
 */
export function normalizeAccountIds(accountIds: (string | number)[]): number[] {
  return accountIds.map((id) => Number(id));
}

/**
 * Filter posts by account IDs
 */
export function filterPostsByAccountIds(
  posts: any[],
  userAccountIds: number[]
): any[] {
  const normalizedUserAccountIds = normalizeAccountIds(userAccountIds);

  return posts.filter((post: any) => {
    // Check if account_id exists in the post
    if (!post.account_id && post.account_id !== 0) {
      return false; // Exclude posts without account_id
    }

    const postAccountId = Number(post.account_id);

    // Check if conversion was successful
    if (isNaN(postAccountId)) {
      return false; // Exclude posts with invalid account_id
    }

    return normalizedUserAccountIds.includes(postAccountId);
  });
}

/**
 * Build empty posts response
 */
export function buildEmptyPostsResponse(
  originalTotal: number = 0
): FilteredPostsResponse {
  return {
    items: [],
    currentPage: DEFAULT_PAGE,
    lastPage: DEFAULT_PAGE,
    nextPage: null,
    total: DEFAULT_TOTAL,
    originalTotal,
    filtered: true,
  };
}

/**
 * Build filtered posts response
 */
export function buildFilteredPostsResponse(
  filteredPosts: any[],
  originalData: any
): FilteredPostsResponse {
  return {
    items: filteredPosts,
    currentPage: originalData?.currentPage || DEFAULT_PAGE,
    lastPage: originalData?.lastPage || DEFAULT_PAGE,
    nextPage: originalData?.nextPage || null,
    total: filteredPosts.length,
    originalTotal: originalData?.total || DEFAULT_TOTAL,
    filtered: true,
  };
}

/**
 * Add account details to posts
 */
export function addAccountDetailsToPosts(
  posts: any[],
  userAccountIds: number[],
  userId: string
): any[] {
  return posts.map((post: any) => {
    const matchingAccountId = userAccountIds.find(
      (id: number) => id === Number(post.account_id)
    );

    return {
      ...post,
      userId,
      account_details: {
        account_id: post.account_id,
        account_type: post.account_type,
        is_connected: !!matchingAccountId,
        user_account_id: matchingAccountId,
      },
    };
  });
}

// ==================== MEDIA UPLOAD HELPERS ====================
/**
 * Get HTTP client based on URL protocol
 */
export function getHttpClient(url: string): typeof https | typeof http {
  return url.startsWith("https") ? https : http;
}

/**
 * Extract clean URL from signed URL (remove query parameters)
 */
export function extractCleanUrl(signedUrl: string): string {
  return signedUrl.split("?")[0];
}

/**
 * Build upload script response
 */
export function buildUploadScriptResponse(
  statusCode: number,
  headers: any,
  finalVideoUrl: string
): {
  statusCode: number;
  headers: any;
  success: boolean;
  finalVideoUrl: string;
} {
  return {
    statusCode,
    headers,
    success: true,
    finalVideoUrl,
  };
}

/**
 * Create media record data
 */
export function buildMediaRecordData(
  userId: string,
  mediaData: { name: string; mime_type: string; videoUrl?: string },
  apiResponse: {
    name: string;
    mime_type: string;
    signed_url: string;
    key: string;
    secure_key: string;
    url: string;
  }
): any {
  return {
    userId,
    name: mediaData.name,
    mime_type: mediaData.mime_type,
    socialbuResponse: {
      name: apiResponse.name,
      mime_type: apiResponse.mime_type,
      signed_url: apiResponse.signed_url,
      key: apiResponse.key,
      secure_key: apiResponse.secure_key,
      url: apiResponse.url,
    },
    uploadScript: {
      videoUrl: mediaData.videoUrl || DEFAULT_VIDEO_URL,
      executed: false,
      status: "pending",
    },
    status: "pending",
  };
}

// ==================== REQUEST BUILDING HELPERS ====================
/**
 * Build connect account request body
 */
export function buildConnectAccountBody(
  provider: string,
  postbackUrl?: string,
  accountId?: string
): Record<string, string> {
  const body: Record<string, string> = { provider };

  if (postbackUrl) {
    body.postback_url = postbackUrl;
  }

  if (accountId) {
    body.account_id = accountId;
  }

  return body;
}

/**
 * Build posts request body
 */
export function buildPostsRequestBody(requestData: {
  type?: string | string[];
  account_id?: number;
  limit?: number;
  offset?: number;
}): Record<string, any> {
  const body: Record<string, any> = {};

  if (requestData.type) {
    const typesToProcess = Array.isArray(requestData.type)
      ? requestData.type
      : [requestData.type];
    body.type = typesToProcess.join(",");
  }

  if (requestData.account_id) {
    body.account_id = requestData.account_id;
  }

  if (requestData.limit) {
    body.limit = requestData.limit;
  }

  if (requestData.offset) {
    body.offset = requestData.offset;
  }

  return body;
}

// ==================== RESPONSE BUILDING HELPERS ====================
/**
 * Build user data for response (excluding sensitive information)
 */
export function buildUserDataForResponse(user: any): any {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    isEmailVerified: user.isEmailVerified,
    socialbu_account_ids: user.socialbu_account_ids || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Build user posts response data
 */
export function buildUserPostsResponseData(
  userData: any,
  posts: any[],
  originalData?: any
): any {
  const responseData: any = {
    user: userData,
    posts,
    total: posts.length,
  };

  // Add pagination info from SocialBu response if available
  if (originalData && typeof originalData === "object") {
    if (originalData.currentPage) responseData.currentPage = originalData.currentPage;
    if (originalData.lastPage) responseData.lastPage = originalData.lastPage;
    if (originalData.nextPage) responseData.nextPage = originalData.nextPage;
    if (originalData.total) responseData.totalFromSocialBu = originalData.total;
  }

  return responseData;
}

