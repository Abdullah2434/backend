export interface SocialBuLoginRequest {
  email: string;
  password: string;
}

export interface SocialBuLoginResponse {
  success: boolean;
  message: string;
  data?: {
    authToken: string;
    id: number;
    name: string;
    email: string;
    verified: boolean;
  };
}

export interface SocialBuApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface SocialBuAccount {
  id: string;
  type: string;
  name: string;
  username?: string;
  picture?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialBuWebhookData {
  account_action: "added" | "updated" | "removed";
  account_id: string;
  account_type: string;
  account_name: string;
  account_username?: string;
  account_picture?: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface SocialBuMediaUpload {
  name: string;
  mime_type: string;
  signed_url: string;
  key: string;
  secure_key: string;
  url: string;
}

export interface MediaUploadRequest {
  videoUrl: string;
  videoName: string;
  mimeType?: string;
}

export interface MediaUploadResult {
  success: boolean;
  message: string;
  data?: {
    mediaId: string;
    socialbuResponse: SocialBuMediaUpload;
    uploadScript: {
      videoUrl: string;
      status: string;
    };
  };
  error?: string;
}

export interface MediaUploadStatus {
  mediaId: string;
  status:
    | "pending"
    | "api_completed"
    | "script_executing"
    | "script_completed"
    | "failed";
  socialbuResponse?: SocialBuMediaUpload;
  uploadScript?: {
    executed: boolean;
    status: string;
    response?: any;
  };
}
