import { Request, Response } from 'express';
import multer from 'multer';
import VideoAvatarService from '../services/videoAvatar.service';
import {
  CreateVideoAvatarRequest,
  CreateVideoAvatarWithFilesRequest,
  CreateVideoAvatarResponse,
  VideoAvatarStatusResponse,
  ApiResponse
} from '../types';

const videoAvatarService = new VideoAvatarService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is a video
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

/**
 * Submit Video Avatar Creation Request (with file uploads)
 * POST /v2/video_avatar
 */
export async function createVideoAvatar(req: Request, res: Response) {
  try {
    const {
      avatar_name,
      avatar_group_id,
      callback_id,
      callback_url
    } = req.body;

    // Check if files are uploaded or URLs are provided
    const trainingFootageFile = req.files?.['training_footage'] as Express.Multer.File;
    const consentStatementFile = req.files?.['consent_statement'] as Express.Multer.File;
    const trainingFootageUrl = req.body.training_footage_url;
    const consentStatementUrl = req.body.consent_statement_url;

    // Validate required fields
    if (!avatar_name) {
      return res.status(400).json({
        success: false,
        message: 'avatar_name is required'
      });
    }

    // Check if we have either files or URLs for both training footage and consent statement
    if (!trainingFootageFile && !trainingFootageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Either training_footage file or training_footage_url is required'
      });
    }

    if (!consentStatementFile && !consentStatementUrl) {
      return res.status(400).json({
        success: false,
        message: 'Either consent_statement file or consent_statement_url is required'
      });
    }

    // Validate callback URL if provided
    if (callback_url) {
      try {
        new URL(callback_url);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid callback_url format'
        });
      }
    }

    // Validate URLs if provided
    if (trainingFootageUrl) {
      try {
        new URL(trainingFootageUrl);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid training_footage_url format'
        });
      }
    }

    if (consentStatementUrl) {
      try {
        new URL(consentStatementUrl);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid consent_statement_url format'
        });
      }
    }

    const request: CreateVideoAvatarWithFilesRequest = {
      avatar_name,
      avatar_group_id,
      callback_id,
      callback_url,
      training_footage_file: trainingFootageFile,
      consent_statement_file: consentStatementFile
    };

    const result: CreateVideoAvatarResponse = await videoAvatarService.createVideoAvatarWithFiles(request, {
      training_footage_url: trainingFootageUrl,
      consent_statement_url: consentStatementUrl
    });

    // Return 202 Accepted as per API specification
    return res.status(202).json(result);

  } catch (error: any) {
    console.error('Error creating video avatar:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Multer middleware for file uploads
 */
export const uploadMiddleware = upload.fields([
  { name: 'training_footage', maxCount: 1 },
  { name: 'consent_statement', maxCount: 1 }
]);

/**
 * Check Video Avatar Generation Status
 * GET /v2/video_avatar/:id
 */
export async function getVideoAvatarStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Avatar ID is required'
      });
    }

    const result: VideoAvatarStatusResponse = await videoAvatarService.getAvatarStatus(id);

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Error getting video avatar status:', error);
    
    // Handle specific error cases
    if (error.message === 'Avatar ID not found') {
      return res.status(404).json({
        success: false,
        message: 'Avatar ID not found'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Get all avatars by group ID
 * GET /v2/video_avatar/group/:groupId
 */
export async function getAvatarsByGroup(req: Request, res: Response) {
  try {
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Avatar Group ID is required'
      });
    }

    const avatars = await videoAvatarService.getAvatarsByGroup(groupId);

    return res.status(200).json({
      success: true,
      data: avatars
    });

  } catch (error: any) {
    console.error('Error getting avatars by group:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Delete video avatar
 * DELETE /v2/video_avatar/:id
 */
export async function deleteVideoAvatar(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Avatar ID is required'
      });
    }

    const deleted = await videoAvatarService.deleteAvatar(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Avatar not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting video avatar:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Health check endpoint for video avatar service
 * GET /v2/video_avatar/health
 */
export async function healthCheck(req: Request, res: Response) {
  try {
    return res.status(200).json({
      success: true,
      message: 'Video Avatar service is healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Video Avatar service is unhealthy',
      error: error.message
    });
  }
}
