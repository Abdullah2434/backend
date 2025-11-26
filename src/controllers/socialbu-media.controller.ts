import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { socialBuMediaService, socialBuService } from "../services/socialbu";
import { ResponseHelper } from "../utils/responseHelper";
import {
  uploadMediaSchema,
  mediaIdParamSchema,
  updateMediaStatusSchema,
  createSocialPostSchema,
} from "../validations/socialbuMedia.validations";

// ==================== CONSTANTS ====================
const VALID_MEDIA_STATUSES = ["uploaded", "failed"] as const;
const UPLOAD_STATUS_CHECK_DELAY_MS = 2000;
const POST_CREATION_DELAY_MS = 1000;

// Account type mappings for captions
const ACCOUNT_TYPE_CAPTION_MAP: Record<string, string> = {
  "instagram.api": "instagram_caption",
  "facebook.profile": "facebook_caption",
  "facebook.page": "facebook_caption",
  "linkedin.profile": "linkedin_caption",
  "twitter.profile": "twitter_caption",
  "tiktok.profile": "tiktok_caption",
  "google.youtube": "youtube_caption",
};

// ==================== HELPER FUNCTIONS ====================
/**
 * Get user ID from authenticated request
 */
function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id.toString();
}

/**
 * Normalize accountIds to array format
 */
function normalizeAccountIds(accountIds: any): number[] {
  if (typeof accountIds === "string") {
    try {
      const parsed = JSON.parse(accountIds);
      return Array.isArray(parsed) ? parsed : [parseInt(accountIds)];
    } catch (e) {
      return [parseInt(accountIds)];
    }
  } else if (typeof accountIds === "number") {
    return [accountIds];
  } else if (
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
function normalizeSelectedAccounts(selectedAccounts: any): any[] {
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
 * Get appropriate caption for account type
 */
function getAccountCaption(
  account: any,
  captions: {
    caption?: string;
    instagram_caption?: string;
    facebook_caption?: string;
    linkedin_caption?: string;
    twitter_caption?: string;
    tiktok_caption?: string;
    youtube_caption?: string;
  }
): string {
  const accountType = account.type;
  const captionKey = ACCOUNT_TYPE_CAPTION_MAP[accountType];

  // Check for specific account type caption
  if (captionKey && captions[captionKey as keyof typeof captions]) {
    return (
      captions[captionKey as keyof typeof captions] || captions.caption || ""
    );
  }

  // Check for facebook.* pattern
  if (accountType?.startsWith("facebook.") && captions.facebook_caption) {
    return captions.facebook_caption;
  }

  // Default to main caption
  return captions.caption || "";
}

/**
 * Format media response data
 */
function formatMediaResponse(data: any) {
  return {
    id: data?._id,
    userId: data?.userId,
    name: data?.name,
    mime_type: data?.mime_type,
    socialbuResponse: data?.socialbuResponse,
    uploadScript: data?.uploadScript,
    status: data?.status,
    errorMessage: data?.errorMessage,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
  };
}

/**
 * Determine HTTP status code based on error message
 */
function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("user not found")
  ) {
    return 401;
  }
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }
  return 500;
}

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Upload media to SocialBu
 * POST /api/socialbu-media/upload
 */
export const uploadMedia = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserIdFromRequest(req);

    // Validate request body
    const validationResult = uploadMediaSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { name, mime_type, videoUrl } = validationResult.data;

    const result = await socialBuMediaService.uploadMedia(userId, {
      name,
      mime_type,
      videoUrl,
    });

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(res, result.message, {
      ...formatMediaResponse(result.data),
    });
  } catch (error: any) {
    console.error("Error in uploadMedia:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to complete media upload workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get user's media uploads
 * GET /api/socialbu-media
 */
export const getUserMedia = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = getUserIdFromRequest(req);

    const result = await socialBuMediaService.getUserMedia(userId);

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(res, result.message, result.data);
  } catch (error: any) {
    console.error("Error in getUserMedia:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get user media",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get media by ID
 * GET /api/socialbu-media/:mediaId
 */
export const getMediaById = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { mediaId } = req.params;

    // Validate mediaId parameter
    const validationResult = mediaIdParamSchema.safeParse({ mediaId });
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const result = await socialBuMediaService.getMediaById(mediaId);

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(res, result.message, result.data);
  } catch (error: any) {
    console.error("Error in getMediaById:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to get media",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Update media status (for webhook or manual updates)
 * PUT /api/socialbu-media/:mediaId/status
 */
export const updateMediaStatus = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { mediaId } = req.params;

    // Validate mediaId parameter
    const mediaIdValidation = mediaIdParamSchema.safeParse({ mediaId });
    if (!mediaIdValidation.success) {
      const errors = mediaIdValidation.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Validate request body
    const validationResult = updateMediaStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const { status, errorMessage } = validationResult.data;

    const result = await socialBuMediaService.updateMediaStatus(
      mediaId,
      status,
      errorMessage
    );

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(res, result.message, result.data);
  } catch (error: any) {
    console.error("Error in updateMediaStatus:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update media status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Create social media post with complete workflow
 * POST /api/socialbu-media/posts
 */
export const createSocialPost = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = getUserIdFromRequest(req);

    // Validate request body
    const validationResult = createSocialPostSchema.safeParse({
      ...req.body,
      userId, // Add userId from auth
    });

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const {
      accountIds,
      name,
      videoUrl,
      date,
      time,
      caption,
      selectedAccounts,
      instagram_caption,
      facebook_caption,
      linkedin_caption,
      twitter_caption,
      tiktok_caption,
      youtube_caption,
    } = validationResult.data;

    // Normalize accountIds and selectedAccounts
    const normalizedAccountIds = normalizeAccountIds(accountIds);
    const normalizedSelectedAccounts =
      normalizeSelectedAccounts(selectedAccounts);

    // Upload media first
    const uploadResult = await socialBuMediaService.uploadMedia(userId, {
      name,
      mime_type: videoUrl,
      videoUrl,
    });

    if (!uploadResult.success) {
      return ResponseHelper.badRequest(
        res,
        "Failed to upload media",
        uploadResult.message
      );
    }

    // Safely extract key from upload result
    const socialbuResponse = uploadResult.data?.socialbuResponse;
    if (!socialbuResponse || !socialbuResponse.key) {
      return ResponseHelper.badRequest(
        res,
        "Failed to get upload key from SocialBu response",
        "Missing key in socialbuResponse"
      );
    }

    const { key } = socialbuResponse;

    // Wait for upload to process
    await new Promise((resolve) =>
      setTimeout(resolve, UPLOAD_STATUS_CHECK_DELAY_MS)
    );

    // Check upload status
    const statusResponse = await socialBuService.makeAuthenticatedRequest(
      "GET",
      `/upload_media/status?key=${encodeURIComponent(key)}`
    );

    if (!statusResponse.success) {
      return ResponseHelper.badRequest(
        res,
        "Failed to check upload status",
        statusResponse.message
      );
    }

    const { upload_token } = statusResponse.data;

    // Format date and time for publish_at
    const publishAt = `${date} ${time}`;

    const results: any[] = [];
    const errors: any[] = [];

    // Prepare captions object
    const captions = {
      caption,
      instagram_caption,
      facebook_caption,
      linkedin_caption,
      twitter_caption,
      tiktok_caption,
      youtube_caption,
    };

    // Loop through each selected account
    try {
      for (const account of normalizedSelectedAccounts) {
        try {
          // Get appropriate caption for account type
          const accountCaption = getAccountCaption(account, captions);

          const postData = {
            accounts: [account.id],
            publish_at: publishAt,
            content: accountCaption,
            existing_attachments: [
              {
                upload_token: upload_token,
              },
            ],
          };

          const postResponse = await socialBuService.makeAuthenticatedRequest(
            "POST",
            "/posts",
            postData
          );

          if (postResponse.success) {
            results.push({
              account: account.name,
              accountId: account.id,
              type: account.type,
              success: true,
              data: postResponse.data,
            });
          } else {
            errors.push({
              account: account.name,
              accountId: account.id,
              type: account.type,
              error: postResponse.message,
            });
          }

          // Add delay between posts to avoid rate limiting
          await new Promise((resolve) =>
            setTimeout(resolve, POST_CREATION_DELAY_MS)
          );
        } catch (error) {
          console.error(
            `Error creating post for account ${account.id}:`,
            error
          );
          errors.push({
            account: account.name,
            accountId: account.id,
            type: account.type,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    } catch (loopError) {
      console.error("Error in account processing loop:", loopError);
      return ResponseHelper.serverError(
        res,
        "Failed to process selected accounts",
        loopError instanceof Error ? loopError.message : "Unknown error"
      );
    }

    return ResponseHelper.success(
      res,
      `Social media posts processing completed. Success: ${results.length}, Errors: ${errors.length}`,
      {
        upload: uploadResult.data,
        status: statusResponse.data,
        results,
        errors,
        summary: {
          total: normalizedSelectedAccounts.length,
          successful: results.length,
          failed: errors.length,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in createSocialPost:", error);
    const status = getErrorStatus(error);
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create social media post",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
