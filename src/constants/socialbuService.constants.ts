/**
 * Constants for SocialBu services
 */

// ==================== API CONFIGURATION ====================
export const SOCIALBU_API_BASE_URL =
  process.env.SOCIALBU_API_URL || "https://socialbu.com/api/v1";
export const SOCIALBU_AUTH_URL = `${SOCIALBU_API_BASE_URL}/auth/get_token`;
export const SOCIALBU_UPLOAD_URL = `${SOCIALBU_API_BASE_URL}/upload_media`;

// ==================== ENVIRONMENT VARIABLES ====================
export const SOCIALBU_EMAIL = process.env.SOCIALBU_EMAIL;
export const SOCIALBU_PASSWORD = process.env.SOCIALBU_PASSWORD;

// ==================== API ENDPOINTS ====================
export const ACCOUNTS_ENDPOINT = "/accounts";
export const POSTS_ENDPOINT = "/posts";

// ==================== HTTP STATUS CODES ====================
export const HTTP_STATUS_UNAUTHORIZED = 401;
export const HTTP_STATUS_FORBIDDEN = 403;
export const HTTP_STATUS_OK = 200;

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
  NO_VALID_TOKEN: "No valid token available",
  NO_TOKEN_AVAILABLE: "No valid SocialBu token available",
  TOKEN_NOT_FOUND: "Token not found",
  NO_RESPONSE_DATA: "No response data from SocialBu",
  EMPTY_RESPONSE: "Empty response",
  FAILED_TO_CONNECT_ACCOUNT: "Failed to connect account after multiple attempts",
  FAILED_TO_RETRIEVE_ACCOUNTS: "Failed to retrieve accounts after multiple attempts",
  FAILED_TO_FETCH_POSTS: "Failed to fetch scheduled posts",
  FAILED_TO_LOGIN: "Failed to login to SocialBu",
  FAILED_TO_GET_POSTS: "Failed to get posts",
  FAILED_TO_RETRIEVE_USER_POSTS: "Failed to retrieve user posts",
  FAILED_TO_UPLOAD_MEDIA: "Failed to upload media",
  FAILED_TO_GET_USER_MEDIA: "Failed to get user media",
  FAILED_TO_UPDATE_MEDIA_STATUS: "Failed to update media status",
  FAILED_TO_GET_MEDIA: "Failed to get media",
  MEDIA_NOT_FOUND: "Media not found",
  USER_NOT_FOUND: "User not found or invalid token",
  UNKNOWN_ERROR: "Unknown error occurred",
} as const;

// ==================== SUCCESS MESSAGES ====================
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: "Successfully logged in and saved token",
  USER_DATA_RETRIEVED: "User data and posts retrieved successfully",
  MEDIA_UPLOAD_COMPLETE: "Complete media upload workflow completed",
  MEDIA_UPLOAD_API_COMPLETE: "Media upload API completed successfully. Upload script pending.",
  USER_MEDIA_RETRIEVED: "User media retrieved successfully",
  MEDIA_STATUS_UPDATED: "Media status updated successfully",
  MEDIA_RETRIEVED: "Media retrieved successfully",
  NO_SCHEDULED_POSTS: "No scheduled posts found. User has no connected SocialBu accounts.",
} as const;

// ==================== AUTHENTICATION KEYWORDS ====================
export const AUTH_ERROR_KEYWORDS = ["401", "403", "Unauthenticated"] as const;

// ==================== DEFAULT VALUES ====================
export const DEFAULT_ACCOUNTS_QUERY = "type=all&type=all";
export const DEFAULT_POST_TYPE = "scheduled";
export const DEFAULT_VIDEO_URL =
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
export const MAX_RETRY_COUNT = 1;

// ==================== HTTP HEADERS ====================
export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
} as const;

// ==================== POST FILTERING ====================
export const POST_DATA_PROPERTIES = {
  ITEMS: "items",
  DATA: "data",
} as const;

// ==================== PAGINATION DEFAULTS ====================
export const DEFAULT_PAGE = 1;
export const DEFAULT_TOTAL = 0;

