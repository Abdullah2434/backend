/**
 * Types for SocialBu services
 */

export interface SocialBuLoginRequest {
  email: string;
  password: string;
}

export interface SocialBuLoginResponse {
  authToken: string;
  id: number;
  name: string;
  email: string;
  verified: boolean;
}

export interface SocialBuApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

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
  account_type?: string;
}

export interface GetPostsRequest {
  type?: string | string[];
  account_id?: number;
  limit?: number;
  offset?: number;
}

export interface SocialBuUploadMediaRequest {
  name: string;
  mime_type: string;
  videoUrl?: string;
}

export interface SocialBuUploadMediaResponse {
  name: string;
  mime_type: string;
  signed_url: string;
  key: string;
  secure_key: string;
  url: string;
}

export interface UploadScriptResponse {
  statusCode: number;
  headers: any;
  success: boolean;
  finalVideoUrl?: string;
  errorMessage?: string;
}

export interface MediaUploadResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface FilteredPostsResponse {
  items: any[];
  currentPage: number;
  lastPage: number;
  nextPage: number | null;
  total: number;
  originalTotal: number;
  filtered: boolean;
}

export interface ConnectAccountRequestBody {
  provider: string;
  postback_url?: string;
  account_id?: string;
}

