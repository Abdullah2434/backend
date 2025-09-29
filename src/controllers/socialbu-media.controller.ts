import { Request, Response } from 'express';
import socialBuMediaService from '../services/socialbu-media.service';
import socialBuService from '../services/socialbu.service';

/**
 * Upload media to SocialBu
 */
export const uploadMedia = async (req: Request, res: Response) => {
  try {
    // For testing purposes, use a hardcoded user ID
    const userId = req.user?._id || "68b19f13b732018f898d7046";
    const { name, mime_type, videoUrl } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    if (!name || !mime_type) {
      return res.status(400).json({
        success: false,
        message: 'Name and mime_type are required'
      });
    }

    console.log('Starting complete media upload workflow for user:', userId, { name, mime_type, videoUrl });

    const result = await socialBuMediaService.uploadMedia(userId, {
      name,
      mime_type,
      videoUrl
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
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
        updatedAt: result.data?.updatedAt
      }
    });
  } catch (error) {
    console.error('Error in media upload workflow:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to complete media upload workflow',
      error: error instanceof Error ? error.message : 'Unknown error'
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
        message: 'User authentication required'
      });
    }

    console.log('Getting media for user:', userId);

    const result = await socialBuMediaService.getUserMedia(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error getting user media:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get user media',
      error: error instanceof Error ? error.message : 'Unknown error'
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
        message: 'User authentication required'
      });
    }

    if (!mediaId) {
      return res.status(400).json({
        success: false,
        message: 'Media ID is required'
      });
    }

    console.log('Getting media by ID:', mediaId, 'for user:', userId);

    const result = await socialBuMediaService.getMediaById(mediaId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error getting media by ID:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get media',
      error: error instanceof Error ? error.message : 'Unknown error'
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
        message: 'Media ID is required'
      });
    }

    if (!status || !['uploaded', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "uploaded" or "failed"'
      });
    }

    console.log('Updating media status:', mediaId, 'to', status);

    const result = await socialBuMediaService.updateMediaStatus(mediaId, status, errorMessage);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error updating media status:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update media status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Create social media post with complete workflow
 */
export const createSocialPost = async (req: Request, res: Response) => {
  try {
    const { accountIds, name,userId, videoUrl, date, time, caption } = req.body;

    // Normalize accountIds to array format
    let normalizedAccountIds = accountIds;
    if (typeof accountIds === 'string') {
      try {
        normalizedAccountIds = JSON.parse(accountIds);
      } catch (e) {
        // If it's a single number as string, convert to array
        normalizedAccountIds = [parseInt(accountIds)];
      }
    } else if (typeof accountIds === 'number') {
      normalizedAccountIds = [accountIds];
    } else if (typeof accountIds === 'object' && accountIds !== null && !Array.isArray(accountIds)) {
      // Handle object format like { '0': 148311, '1': 148312 }
      normalizedAccountIds = Object.values(accountIds).filter(val => typeof val === 'number');
    }

    // Validate required fields
    if (!normalizedAccountIds || !Array.isArray(normalizedAccountIds) || normalizedAccountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Account IDs array is required',
        debug: {
          received: accountIds,
          normalized: normalizedAccountIds,
          type: typeof accountIds,
          isArray: Array.isArray(normalizedAccountIds),
          length: normalizedAccountIds?.length
        }
      });
    }

    if (!name || !videoUrl || !date || !time || !caption) {
      return res.status(400).json({
        success: false,
        message: 'Name, videoUrl, date, time, and caption are required'
      });
    }

    console.log('Starting social media post creation workflow:', {
      accountIds: normalizedAccountIds,
      name,
      videoUrl,
      date,
      time,
      caption
    });

    // Step 1: Use the working media upload logic
    console.log('Step 1: Using working media upload logic...');
    const uploadResult = await socialBuMediaService.uploadMedia(userId, {
      name,
      mime_type: videoUrl,
      videoUrl
    });

    if (!uploadResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload media',
        error: uploadResult.message
      });
    }

    const { key } = uploadResult.data?.socialbuResponse || {};
    console.log('Media upload completed successfully, key:', key);

    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'No key returned from upload',
        error: 'Missing upload key'
      });
    }

    // Step 2: Wait 2 seconds and check upload status
    console.log('Step 2: Waiting 2 seconds before checking upload status...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusResponse = await socialBuService.makeAuthenticatedRequest(
      'GET',
      `/upload_media/status?key=${encodeURIComponent(key)}`
    );

    console.log('Status response:', statusResponse);

    if (!statusResponse.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to check upload status',
        error: statusResponse.message
      });
    }

    const { upload_token } = statusResponse.data;
    console.log('Upload status checked successfully, upload_token:', upload_token);

    // Step 3: Create social media post
    console.log('Step 3: Creating social media post...');
    
    // Format date and time for publish_at
    const publishAt = `${date} ${time}`;
    
    const postData = {
      accounts: normalizedAccountIds,
      publish_at: publishAt,
      content: caption,
      existing_attachments: [
        {
          upload_token: upload_token
        }
      ]
    };

    const postResponse = await socialBuService.makeAuthenticatedRequest(
      'POST',
      '/posts',
      postData
    );

    if (!postResponse.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create social media post',
        error: postResponse.message
      });
    }

    console.log('Social media post created successfully');

    res.status(200).json({
      success: true,
      message: 'Social media post created successfully',
      data: {
        upload: uploadResult.data,
        status: statusResponse.data,
        post: postResponse.data
      }
    });

  } catch (error) {
    console.error('Error in social media post creation workflow:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create social media post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
