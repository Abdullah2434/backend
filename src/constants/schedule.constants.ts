/**
 * Constants for schedule controller
 */

import { PostStatus } from "../types/schedule.types";

// ==================== CONSTANTS ====================
export const POST_ID_SEPARATOR = "_";

export const POST_STATUSES: readonly PostStatus[] = [
  "pending",
  "completed",
  "processing",
  "failed",
] as const;
