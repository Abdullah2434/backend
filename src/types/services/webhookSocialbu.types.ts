/**
 * Types for webhookSocialbu service
 */

export interface SocialBuWebhookData {
  account_action: string;
  account_id: number;
  account_type: string;
  account_name: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export type AccountAction = "added" | "updated" | "removed";

