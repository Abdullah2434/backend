import { Request, Response } from "express";
import socialBuMediaService from "../services/socialbu-media.service";
import socialBuService from "../services/socialbu.service";

/**
 * Upload media to SocialBu
 */
export const uploadMedia = async (req: Request, res: Response) => {
  try {
    // change id to _id
    // For testing purposes, use a hardcoded user ID
    const userId = req.user?._id || "68b19f13b732018f898d7046";
    const { name, mime_type, videoUrl } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    if (!name || !mime_type) {
      return res.status(400).json({
        success: false,
        message: "Name and mime_type are required",
      });
    }


    const result = await socialBuMediaService.uploadMedia(userId, {
      name,
      mime_type,
      videoUrl,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    // Return complete workflow data
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        id: result.data?._id,
        userId: result.data?.userId,
        name: result.data?.name,
        mime_type: result.data?.mime_type,

        // SocialBu API Response
        socialbuResponse: result.data?.socialbuResponse,

        // Upload Script Execution Data
        uploadScript: result.data?.uploadScript,

        // Overall Status
        status: result.data?.status,
        errorMessage: result.data?.errorMessage,

        // Timestamps
        createdAt: result.data?.createdAt,
        updatedAt: result.data?.updatedAt,
      },
    });
  } catch (error) {
 
    res.status(500).json({
      success: false,
      message: "Failed to complete media upload workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get user's media uploads
 */
export const getUserMedia = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id; // Get user ID from authenticated request

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }



    const result = await socialBuMediaService.getUserMedia(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
   

    res.status(500).json({
      success: false,
      message: "Failed to get user media",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get media by ID
 */
export const getMediaById = async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    const userId = req.user?._id; // Get user ID from authenticated request

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    if (!mediaId) {
      return res.status(400).json({
        success: false,
        message: "Media ID is required",
      });
    }



    const result = await socialBuMediaService.getMediaById(mediaId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: "Failed to get media",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Update media status (for webhook or manual updates)
 */
export const updateMediaStatus = async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    const { status, errorMessage } = req.body;

    if (!mediaId) {
      return res.status(400).json({
        success: false,
        message: "Media ID is required",
      });
    }

    if (!status || !["uploaded", "failed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "uploaded" or "failed"',
      });
    }


    const result = await socialBuMediaService.updateMediaStatus(
      mediaId,
      status,
      errorMessage
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: "Failed to update media status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Create social media post with complete workflow
 */
export const createSocialPost = async (req: Request, res: Response) => {
  try {
    const {
      accountIds,
      name,
      userId,
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
    } = req.body;

    // Normalize accountIds to array format
    let normalizedAccountIds = accountIds;
    if (typeof accountIds === "string") {
      try {
        normalizedAccountIds = JSON.parse(accountIds);
      } catch (e) {
        // If it's a single number as string, convert to array
        normalizedAccountIds = [parseInt(accountIds)];
      }
    } else if (typeof accountIds === "number") {
      normalizedAccountIds = [accountIds];
    } else if (
      typeof accountIds === "object" &&
      accountIds !== null &&
      !Array.isArray(accountIds)
    ) {
      // Handle object format like { '0': 148311, '1': 148312 }
      normalizedAccountIds = Object.values(accountIds).filter(
        (val) => typeof val === "number"
      );
    }

    // Validate required fields
    if (
      !normalizedAccountIds ||
      !Array.isArray(normalizedAccountIds) ||
      normalizedAccountIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Account IDs array is required",
        debug: {
          received: accountIds,
          normalized: normalizedAccountIds,
          type: typeof accountIds,
          isArray: Array.isArray(normalizedAccountIds),
          length: normalizedAccountIds?.length,
        },
      });
    }

    // Convert selectedAccounts object to array if needed
    let normalizedSelectedAccounts = selectedAccounts;
    if (
      selectedAccounts &&
      typeof selectedAccounts === "object" &&
      !Array.isArray(selectedAccounts)
    ) {
      normalizedSelectedAccounts = Object.values(selectedAccounts);
    }

    // Validate selectedAccounts
    if (
      !normalizedSelectedAccounts ||
      !Array.isArray(normalizedSelectedAccounts) ||
      normalizedSelectedAccounts.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Selected accounts are required and must be an array",
        debug: {
          received: selectedAccounts,
          normalized: normalizedSelectedAccounts,
          type: typeof selectedAccounts,
          isArray: Array.isArray(normalizedSelectedAccounts),
          length: normalizedSelectedAccounts?.length,
        },
      });
    }

    

    if (!name || !videoUrl || !date || !time || !caption) {
      return res.status(400).json({
        success: false,
        message: "Name, videoUrl, date, time, and caption are required",
      });
    }

  
    const uploadResult = await socialBuMediaService.uploadMedia(userId, {
      name,
      mime_type: videoUrl,
      videoUrl,
    });

    if (!uploadResult.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to upload media",
        error: uploadResult.message,
      });
    }

    // Safely extract key from upload result
    const socialbuResponse = uploadResult.data?.socialbuResponse;
    if (!socialbuResponse || !socialbuResponse.key) {
      return res.status(400).json({
        success: false,
        message: "Failed to get upload key from SocialBu response",
        error: "Missing key in socialbuResponse",
      });
    }

    const { key } = socialbuResponse;
   
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await socialBuService.makeAuthenticatedRequest(
      "GET",
      `/upload_media/status?key=${encodeURIComponent(key)}`
    );

  

    if (!statusResponse.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to check upload status",
        error: statusResponse.message,
      });
    }

    const { upload_token } = statusResponse.data;
  

    // Format date and time for publish_at
    const publishAt = `${date} ${time}`;

    const results = [];
    const errors = [];

    // Loop through each selected account
    try {
      for (const account of normalizedSelectedAccounts) {
        try {
         
          // Determine the appropriate caption based on account type
          let accountCaption = caption; // Default to main caption

          if (account.type === "instagram.api" && instagram_caption) {
            accountCaption = instagram_caption;
          } else if (
            (account.type === "facebook.profile" ||
              account.type === "facebook.page" ||
              account.type?.startsWith("facebook.")) &&
            facebook_caption
          ) {
            accountCaption = facebook_caption;
          } else if (account.type === "linkedin.profile" && linkedin_caption) {
            accountCaption = linkedin_caption;
          } else if (account.type === "twitter.profile" && twitter_caption) {
            accountCaption = twitter_caption;
          } else if (account.type === "tiktok.profile" && tiktok_caption) {
            accountCaption = tiktok_caption;
          } else if (account.type === "google.youtube" && youtube_caption) {
            accountCaption = youtube_caption;
          }

          const postData = {
            accounts: [account.id], // Single account per post
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

          // Add a small delay between posts to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
        
          errors.push({
            account: account.name,
            accountId: account.id,
            type: account.type,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    } catch (loopError) {
      
      return res.status(500).json({
        success: false,
        message: "Failed to process selected accounts",
        error: loopError instanceof Error ? loopError.message : "Unknown error",
      });
    }

 
    res.status(200).json({
      success: true,
      message: `Social media posts processing completed. Success: ${results.length}, Errors: ${errors.length}`,
      data: {
        upload: uploadResult.data,
        status: statusResponse.data,
        results: results,
        errors: errors,
        summary: {
          total: normalizedSelectedAccounts.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    
    res.status(500).json({
      success: false,
      message: "Failed to create social media post",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
