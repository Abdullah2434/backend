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
      // Signal error without accept flag per multer types
      cb(new Error('Only video files are allowed') as any);
    }
  }
});

/**
 * Submit Video Avatar Creation Request (with file uploads)
 * POST /v2/video_avatar
 */
export async function createVideoAvatar(req: Request, res: Response) {
  try {
    console.log('POST /v2/video_avatar hit')
    console.log('Headers:', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      xApiKey: req.headers['x-api-key'] ? 'present' : 'missing',
      authorization: req.headers['authorization'] ? 'present' : 'missing'
    })
    console.log('Body keys:', Object.keys(req.body || {}))
    const rawFiles: any = (req as any).files || {}
    console.log('Files fields:', Object.keys(rawFiles || {}))
    if (rawFiles?.training_footage?.[0]) {
      console.log('training_footage file meta:', {
        fieldname: rawFiles.training_footage[0].fieldname,
        originalname: rawFiles.training_footage[0].originalname,
        mimetype: rawFiles.training_footage[0].mimetype,
        size: rawFiles.training_footage[0].buffer?.byteLength
      })
    } else {
      console.log('training_footage file: missing')
    }
    if (rawFiles?.consent_statement?.[0]) {
      console.log('consent_statement file meta:', {
        fieldname: rawFiles.consent_statement[0].fieldname,
        originalname: rawFiles.consent_statement[0].originalname,
        mimetype: rawFiles.consent_statement[0].mimetype,
        size: rawFiles.consent_statement[0].buffer?.byteLength
      })
    } else {
      console.log('consent_statement file: missing')
    }
    const {
      avatar_name,
      avatar_group_id,
      callback_id,
      callback_url,
      training_footage_url,
      consent_statement_url,
    } = req.body;

    const trainingFootageFile = (rawFiles?.training_footage?.[0] as Express.Multer.File) || undefined
    const consentStatementFile = (rawFiles?.consent_statement?.[0] as Express.Multer.File) || undefined

    if (!avatar_name) {
      return res.status(400).json({ success: false, message: "avatar_name is required" });
    }

    if (!trainingFootageFile && !training_footage_url) {
      return res.status(400).json({
        success: false,
        message: "Either training_footage file or training_footage_url is required",
      });
    }

    if (!consentStatementFile && !consent_statement_url) {
      return res.status(400).json({
        success: false,
        message: "Either consent_statement file or consent_statement_url is required",
      });
    }
    // Zero-byte guard
    if (trainingFootageFile && (!trainingFootageFile.buffer || trainingFootageFile.buffer.byteLength === 0)) {
      console.error('Received empty training_footage buffer')
      return res.status(400).json({ success: false, message: 'Empty training_footage file' })
    }
    if (consentStatementFile && (!consentStatementFile.buffer || consentStatementFile.buffer.byteLength === 0)) {
      console.error('Received empty consent_statement buffer')
      return res.status(400).json({ success: false, message: 'Empty consent_statement file' })
    }

    // Validate URLs
    if (callback_url) {
      try {
        new URL(callback_url);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid callback_url format" });
      }
    }

    let trainingUrlToUse = training_footage_url;
    let consentUrlToUse = consent_statement_url;

    const request: CreateVideoAvatarWithFilesRequest = {
      avatar_name,
      avatar_group_id,
      callback_id,
      callback_url,
      training_footage_file: trainingFootageFile,
      consent_statement_file: consentStatementFile,
    };

    const result = await videoAvatarService.createVideoAvatarWithFiles(request, {
      training_footage_url: trainingUrlToUse,
      consent_statement_url: consentUrlToUse,
    });

    return res.status(202).json(result);
  } catch (error: any) {
    console.error("Error creating video avatar:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}
/**
 * Multer middleware for file uploads
 */
export const uploadMiddleware = (req: any, res: any, next: any) => {
  const mw = upload.fields([
    { name: 'training_footage', maxCount: 1 },
    { name: 'consent_statement', maxCount: 1 }
  ])
  mw(req, res, (err: any) => {
    if (err) {
      console.error('Multer error:', err)
      return res.status(400).json({ success: false, message: 'Upload error', error: String(err) })
    }
    console.log('Multer parsed files:', Object.keys((req as any).files || {}))
    next()
  })
}

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
