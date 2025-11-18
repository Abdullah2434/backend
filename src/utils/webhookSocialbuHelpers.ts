import { SocialBuWebhookData, WebhookResponse, AccountAction } from "../types/services/webhookSocialbu.types";

// ==================== CONSTANTS ====================
export const VALID_ACCOUNT_ACTIONS: AccountAction[] = ["added", "updated", "removed"];
export const ALL_USERS_TARGET = "all_users";

// ==================== QUERY BUILDING ====================
/**
 * Build user update query based on userId
 */
export function buildUserUpdateQuery(userId?: string): { _id?: string } | {} {
  return userId ? { _id: userId } : {};
}

// ==================== RESPONSE BUILDING ====================
/**
 * Build success webhook response
 */
export function buildSuccessWebhookResponse(
  message: string,
  data?: any
): WebhookResponse {
  return {
    success: true,
    message,
    data: data || null,
  };
}

/**
 * Build error webhook response
 */
export function buildErrorWebhookResponse(
  message: string,
  error?: string | Error
): WebhookResponse {
  const errorMessage =
    error instanceof Error ? error.message : error || "Unknown error";
  return {
    success: false,
    message,
    error: errorMessage,
  };
}

/**
 * Build account action response data
 */
export function buildAccountActionResponseData(
  accountId: number,
  accountName: string,
  accountType: string,
  usersUpdated: number,
  userId?: string
) {
  return {
    account_id: accountId,
    account_name: accountName,
    account_type: accountType,
    users_updated: usersUpdated,
    target_user: userId || ALL_USERS_TARGET,
  };
}

/**
 * Build account added/updated response
 */
export function buildAccountAddedResponse(
  accountId: number,
  accountName: string,
  accountType: string,
  usersUpdated: number,
  userId?: string,
  isUpdated: boolean = false
): WebhookResponse {
  const action = isUpdated ? "updated" : "added";
  const message = `Account ${accountId} (${accountName}) ${action} successfully${
    userId ? ` to user ${userId}` : " to all users"
  }`;

  return buildSuccessWebhookResponse(
    message,
    buildAccountActionResponseData(
      accountId,
      accountName,
      accountType,
      usersUpdated,
      userId
    )
  );
}

/**
 * Build account removed response
 */
export function buildAccountRemovedResponse(
  accountId: number,
  accountName: string,
  accountType: string,
  usersUpdated: number,
  userId?: string
): WebhookResponse {
  const message = `Account ${accountId} (${accountName}) removed successfully${
    userId ? ` from user ${userId}` : " from all users"
  }`;

  return buildSuccessWebhookResponse(
    message,
    buildAccountActionResponseData(
      accountId,
      accountName,
      accountType,
      usersUpdated,
      userId
    )
  );
}

/**
 * Build unknown action response
 */
export function buildUnknownActionResponse(
  accountAction: string
): WebhookResponse {
  return buildErrorWebhookResponse(`Unknown account action: ${accountAction}`);
}

// ==================== VALIDATION ====================
/**
 * Validate account action
 */
export function isValidAccountAction(
  action: string
): action is AccountAction {
  return VALID_ACCOUNT_ACTIONS.includes(action as AccountAction);
}

/**
 * Validate webhook data
 */
export function validateWebhookData(
  data: Partial<SocialBuWebhookData>
): { valid: boolean; error?: string } {
  if (!data.account_action) {
    return { valid: false, error: "account_action is required" };
  }
  if (!isValidAccountAction(data.account_action)) {
    return {
      valid: false,
      error: `Invalid account_action: ${data.account_action}`,
    };
  }
  if (data.account_id === undefined || data.account_id === null) {
    return { valid: false, error: "account_id is required" };
  }
  if (!data.account_type) {
    return { valid: false, error: "account_type is required" };
  }
  if (!data.account_name) {
    return { valid: false, error: "account_name is required" };
  }
  return { valid: true };
}

// ==================== USER ACCOUNT UTILITIES ====================
/**
 * Check if user has account
 */
export function userHasAccount(
  userAccountIds: number[] | undefined,
  accountId: number
): boolean {
  return userAccountIds ? userAccountIds.includes(accountId) : false;
}

/**
 * Build user account check response
 */
export function buildUserAccountCheckResponse(
  userId: string,
  accountId: number,
  hasAccount: boolean,
  userAccounts: number[]
): WebhookResponse {
  return buildSuccessWebhookResponse(
    hasAccount ? "User has this account" : "User does not have this account",
    {
      userId,
      accountId,
      hasAccount,
      userAccounts,
    }
  );
}

