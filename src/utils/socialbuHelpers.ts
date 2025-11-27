/**
 * SocialBu-specific helper functions
 */

/**
 * Normalize account IDs to numbers (simple version)
 */
export function normalizeAccountIds(
  accountIds: (string | number)[]
): number[] {
  return accountIds.map((id) => Number(id));
}

/**
 * Normalize accountIds to array format (complex version for media controller)
 */
export function normalizeAccountIdsComplex(accountIds: unknown): number[] {
  if (typeof accountIds === "string") {
    try {
      const parsed = JSON.parse(accountIds);
      return Array.isArray(parsed) ? parsed : [parseInt(accountIds, 10)];
    } catch {
      return [parseInt(accountIds, 10)];
    }
  }

  if (typeof accountIds === "number") {
    return [accountIds];
  }

  if (
    typeof accountIds === "object" &&
    accountIds !== null &&
    !Array.isArray(accountIds)
  ) {
    return Object.values(accountIds).filter(
      (val) => typeof val === "number"
    ) as number[];
  }

  return Array.isArray(accountIds) ? accountIds : [];
}

/**
 * Normalize selectedAccounts to array format
 */
export function normalizeSelectedAccounts(selectedAccounts: unknown): any[] {
  if (
    selectedAccounts &&
    typeof selectedAccounts === "object" &&
    !Array.isArray(selectedAccounts)
  ) {
    return Object.values(selectedAccounts);
  }
  return Array.isArray(selectedAccounts) ? selectedAccounts : [];
}

/**
 * Parse account ID from string to number
 */
export function parseAccountId(accountId: string): number {
  const accountIdNumber = parseInt(accountId, 10);
  if (isNaN(accountIdNumber)) {
    throw new Error("Invalid account ID format. Must be a valid number");
  }
  return accountIdNumber;
}

/**
 * Build user-specific postback URL
 */
export function buildUserPostbackUrl(
  userId: string,
  postbackUrl?: string,
  defaultPostbackUrl?: string
): string {
  const baseUrl = postbackUrl || defaultPostbackUrl || "";
  return `${baseUrl}?user_id=${userId}`;
}

