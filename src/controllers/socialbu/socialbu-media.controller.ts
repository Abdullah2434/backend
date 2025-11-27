import { Response } from "express";
import { AuthenticatedRequest } from "../../types";
import { socialBuMediaService, socialBuService } from "../../services/socialbu";
import { ResponseHelper } from "../../utils/responseHelper";
import {
  uploadMediaSchema,
  mediaIdParamSchema,
  updateMediaStatusSchema,
  createSocialPostSchema,
} from "../../validations/socialbuMedia.validations";
import {
  getUserIdFromRequest,
  formatValidationErrors,
  handleControllerError,
} from "../../utils/controllerHelpers";
import {
  normalizeAccountIdsComplex,
  normalizeSelectedAccounts,
} from "../../utils/socialbuHelpers";
import {
  UPLOAD_STATUS_CHECK_DELAY_MS,
  POST_CREATION_DELAY_MS,
  ACCOUNT_TYPE_CAPTION_MAP,
} from "../../constants/socialbuMedia.constants";
import { Captions, MediaResponse, Account } from "../../types/socialbu.types";

// ==================== HELPER FUNCTIONS ====================
/**
 * Get appropriate caption for account type
 */
function getAccountCaption(account: Account, captions: Captions): string {
  const accountType = account.type;
  const captionKey = ACCOUNT_TYPE_CAPTION_MAP[accountType];

  // Check for specific account type caption
  if (captionKey && captions[captionKey as keyof Captions]) {
    return (
      (captions[captionKey as keyof Captions] as string) ||
      captions.caption ||
      ""
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
function formatMediaResponse(data: any): MediaResponse {
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

// ==================== CONTROLLER FUNCTIONS ====================
/**
 * Upload media to SocialBu
 * POST /api/socialbu-media/upload
 */
export const uploadMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    const userId = getUserIdFromRequest(req);

    // Validate request body
    const validationResult = uploadMediaSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "uploadMedia",
      "Failed to complete media upload workflow"
    );
  }
};

/**
 * Get user's media uploads
 * GET /api/socialbu-media
 */
export const getUserMedia = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    const userId = getUserIdFromRequest(req);

    const result = await socialBuMediaService.getUserMedia(userId);

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(res, result.message, result.data);
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "getUserMedia",
      "Failed to get user media"
    );
  }
};

/**
 * Get media by ID
 * GET /api/socialbu-media/:mediaId
 */
export const getMediaById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    getUserIdFromRequest(req); // Validate user is authenticated
    const { mediaId } = req.params;

    // Validate mediaId parameter
    const validationResult = mediaIdParamSchema.safeParse({ mediaId });
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    const result = await socialBuMediaService.getMediaById(mediaId);

    if (!result.success) {
      return ResponseHelper.badRequest(res, result.message, result.error);
    }

    return ResponseHelper.success(res, result.message, result.data);
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "getMediaById",
      "Failed to get media"
    );
  }
};

/**
 * Update media status (for webhook or manual updates)
 * PUT /api/socialbu-media/:mediaId/status
 */
export const updateMediaStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    const { mediaId } = req.params;

    // Validate mediaId parameter
    const mediaIdValidation = mediaIdParamSchema.safeParse({ mediaId });
    if (!mediaIdValidation.success) {
      const errors = formatValidationErrors(mediaIdValidation.error);
      return ResponseHelper.badRequest(res, "Validation failed", errors);
    }

    // Validate request body
    const validationResult = updateMediaStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "updateMediaStatus",
      "Failed to update media status"
    );
  }
};

/**
 * Create social media post with complete workflow
 * POST /api/socialbu-media/posts
 */
export const createSocialPost = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    const userId = getUserIdFromRequest(req);

    // Validate request body
    const validationResult = createSocialPostSchema.safeParse({
      ...req.body,
      userId, // Add userId from auth
    });

    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
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
    const captions: Captions = {
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
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "createSocialPost",
      "Failed to create social media post"
    );
  }
};
