import { Request, Response } from 'express';
import socialBuMediaService from '../services/socialbu-media.service';

/**
 * Upload media to SocialBu
 */
export const uploadMedia = async (req: Request, res: Response) => {
  try {
    // For testing purposes, use a hardcoded user ID
    const userId = req.user?.id || "68b19f13b732018f898d7046";
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
    const userId = req.user?.id; // Get user ID from authenticated request

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
    const userId = req.user?.id; // Get user ID from authenticated request

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
