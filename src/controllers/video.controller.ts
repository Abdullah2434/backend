import { Request, Response } from 'express'
import AuthService from '../services/auth.service'
import VideoService from '../services/video.service'
import DefaultAvatar from '../models/avatar';
import DefaultVoice from '../models/voice';
import { photoAvatarQueue } from '../queues/photoAvatarQueue';
import multer from 'multer';
import https from 'https';
import url from 'url';

const authService = new AuthService()
const videoService = new VideoService()
const upload = multer({ dest: '/tmp' });

function requireAuth(req: Request) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) throw new Error('Access token is required')
  const payload = authService.verifyToken(token)
  if (!payload) throw new Error('Invalid or expired access token')
  return payload
}

export async function gallery(req: Request, res: Response) {
  try {
    const payload = requireAuth(req)
    const user = await authService.getCurrentUser(req.headers.authorization?.replace('Bearer ', '') || '')
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired access token' })
    }

    const videosWithUrls = await videoService.getUserVideosWithDownloadUrls(user._id.toString())
    const stats = await videoService.getUserVideoStats(user._id.toString())

    const formattedVideos = videosWithUrls.map((video: any) => ({
      id: video._id.toString(),
      videoId: video.videoId,
      title: video.title,
      status: video.status,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
      metadata: video.metadata,
      downloadUrl: video.downloadUrl || null
    }))

    return res.json({
      success: true,
      message: 'Video gallery retrieved successfully',
      data: {
        videos: formattedVideos,
        totalCount: stats.totalCount,
        readyCount: stats.readyCount,
        processingCount: stats.processingCount,
        failedCount: stats.failedCount
      }
    })
  } catch (e: any) {
    const status = e.message.includes('Access token') ? 401 : 500
    return res.status(status).json({ success: false, message: e.message || 'Internal server error' })
  }
}

export async function download(req: Request, res: Response) {
  try {
    const { videoUrl, email, title } = req.body
    
    // Validate required fields
    const requiredFields = ['videoUrl', 'email', 'title']
    for (const field of requiredFields) {
      if (!req.body[field] || String(req.body[field]).trim() === '') {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`
        })
      }
    }

    const result = await videoService.downloadAndUploadVideo(videoUrl, email, title)

    return res.json({
      success: true,
      message: 'Video downloaded and uploaded successfully',
      data: result
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message || 'Internal server error' })
  }
}

export async function updateStatus(req: Request, res: Response) {
  try {
    const { videoId, status, metadata } = req.body
    
    if (!videoId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Video ID and status are required'
      })
    }
    
    if (!['processing', 'ready', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be processing, ready, or failed'
      })
    }

    const updatedVideo = await videoService.updateVideoStatus(videoId, status)
    
    if (!updatedVideo) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      })
    }

    // Update metadata if provided
    if (metadata) {
      await videoService.updateVideoMetadata(videoId, metadata)
    }

    return res.json({
      success: true,
      message: 'Video status updated successfully',
      data: {
        videoId: updatedVideo.videoId,
        status: updatedVideo.status,
        updatedAt: updatedVideo.updatedAt
      }
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message || 'Internal server error' })
  }
}

export async function deleteVideo(req: Request, res: Response) {
  try {
    const payload = requireAuth(req)
    const { videoId } = req.body
    
    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Video ID is required'
      })
    }

    const video = await videoService.getVideo(videoId)
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      })
    }

    // Verify video belongs to user
    if (video.userId && video.userId.toString() !== payload.userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this video'
      })
    }

    const deleted = await videoService.deleteVideo(videoId)
    
    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete video'
      })
    }

    return res.json({
      success: true,
      message: 'Video deleted successfully'
    })
  } catch (e: any) {
    const status = e.message.includes('Access token') ? 401 : 500
    return res.status(status).json({ success: false, message: e.message || 'Internal server error' })
  }
}

export async function downloadProxy(req: Request, res: Response) {
  try {
    const videoUrl = String(req.query.url || '')
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Video URL is required'
      })
    }

    console.log('Proxying video download from:', videoUrl)

    // Fetch the video from S3 (server-side, no CORS issues)
    const videoResponse = await fetch(videoUrl)
    
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.status}`)
    }

    // Get video data
    const videoBuffer = await videoResponse.arrayBuffer()
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4'

    // Return the video as a downloadable file
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"')
    res.setHeader('Content-Length', videoBuffer.byteLength.toString())
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    
    return res.status(200).send(Buffer.from(videoBuffer))
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message || 'Internal server error' })
  }
}

export async function getAvatars(req: Request, res: Response) {
  try {
    const user = await authService.getCurrentUser(req.headers.authorization?.replace('Bearer ', '') || '')
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired access token' })
    }
    const userObjectId = user._id;
    // Fetch custom avatars for user
    const customAvatars = await DefaultAvatar.find({ userId: userObjectId,status: 'ready'  });
    // Fetch default avatars (no userId)
    const defaultAvatars = await DefaultAvatar.find({ userId: { $exists: false } , default: true });
    return res.json({
      success: true,
      custom: customAvatars,
      default: defaultAvatars,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message || 'Internal server error' });
  }
}

export async function getVoices(req: Request, res: Response) {
  try {
    const user = await authService.getCurrentUser(req.headers.authorization?.replace('Bearer ', '') || '')
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired access token' })
    }
    const userObjectId = user._id;
    // Fetch custom voices for user
    const customVoices = await DefaultVoice.find({ userId: userObjectId });
    // Fetch default voices (no userId)
    const defaultVoices = await DefaultVoice.find({ userId: { $exists: false } , default: true  });
    return res.json({
      success: true,
      custom: customVoices,
      default: defaultVoices,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message || 'Internal server error' });
  }
}

export const createPhotoAvatarUpload = upload.single('image');

export async function createPhotoAvatar(req: Request & { file?: Express.Multer.File }, res: Response) {
  try {
    const { age_group, name, gender, userId, ethnicity } = req.body;
    if (!req.file || !age_group || !name || !gender || !userId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    // Use uploaded file path
    const tempImagePath = req.file.path;
    // Add job to BullMQ queue
    await photoAvatarQueue.add('create-photo-avatar', {
      imagePath: tempImagePath,
      age_group,
      name,
      gender,
      userId,
      ethnicity,
      mimeType: req.file.mimetype, // Pass the correct MIME type
    });
    return res.json({ success: true, message: 'Photo avatar creation started. You will be notified when ready.' });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message || 'Internal server error' });
  }
}

export async function createVideo(req: Request, res: Response) {
  try {
    const requiredFields = [
      'prompt', 'avatar', 'name', 'position', 'companyName', 
      'license', 'tailoredFit', 'socialHandles', 'videoTopic', 
      'topicKeyPoints', 'city', 'preferredTone', 'callToAction', 'email'
    ];
    for (const field of requiredFields) {
      if (!req.body[field] || String(req.body[field]).trim() === '') {
        return res.status(400).json({
          success: false,
          message: `${field} is required`
        });
      }
    }
    const webhookUrl = process.env.VIDEO_CREATION_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('VIDEO_CREATION_WEBHOOK_URL environment variable is not set');
      return res.status(500).json({ success: false, message: 'Video creation service is not configured' });
    }
    const body = req.body;
    const webhookData = {
      prompt: body.prompt,
      avatar: body.avatar,
      name: body.name,
      position: body.position,
      companyName: body.companyName,
      license: body.license,
      tailoredFit: body.tailoredFit,
      socialHandles: body.socialHandles,
      videoTopic: body.videoTopic,
      topicKeyPoints: body.topicKeyPoints,
      city: body.city,
      preferredTone: body.preferredTone,
      zipCode: 90014,
      zipKeyPoints: 'new bars and restaurants',
      callToAction: body.callToAction,
      email: body.email,
      timestamp: new Date().toISOString(),
      requestId: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    // Use native node http(s) for webhook POST
    const https = require('https');
    const url = require('url');
    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(webhookData);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      port: parsedUrl.port || 443,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const webhookReq = https.request(options, (webhookRes: any) => {
      let data = '';
      webhookRes.on('data', (chunk: any) => { data += chunk; });
      webhookRes.on('end', () => {
        let webhookResult;
        try { webhookResult = JSON.parse(data); } catch { webhookResult = data; }
        if (webhookRes.statusCode < 200 || webhookRes.statusCode >= 300) {
          return res.status(502).json({
            success: false,
            message: 'Failed to create video. Please try again later.',
            error: `Webhook error: ${webhookRes.statusCode}`
          });
        }
        return res.status(200).json({
          success: true,
          message: 'Video creation request submitted successfully',
          data: {
            requestId: webhookData.requestId,
            webhookResponse: webhookResult,
            timestamp: webhookData.timestamp,
            status: 'pending'
          }
        });
      });
    });
    webhookReq.on('error', (error: any) => {
      console.error('Create video API Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error. Please try again later.',
        error: error.message || error
      });
    });
    webhookReq.write(postData);
    webhookReq.end();
  } catch (error: any) {
    console.error('Create video API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: error.message
    });
  }
}

export async function generateVideo(req: Request, res: Response) {
  try {
    const body = req.body;
    const requiredFields = [
      'hook', 'body', 'conclusion', 'company_name', 
      'social_handles', 'license', 'avatar', 'email', 
      'title'
    ];
    for (const field of requiredFields) {
      console.log(`Checking field ${field}:`, body[field]);
      if (!body[field] || String(body[field]).trim() === '') {
        console.log(`Field ${field} is missing or empty`);
        return res.status(400).json({
          success: false,
          message: `Missing or empty required field: ${field}`,
          error: `Field ${field} is required and cannot be empty`,
          receivedData: body
        });
      }
    }
    const webhookUrl = process.env.GENERATE_VIDEO_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({
        success: false,
        message: 'GENERATE_VIDEO_WEBHOOK_URL environment variable is not set'
      });
    }
    // Get gender from DefaultAvatar
    const avatarDoc = await DefaultAvatar.findOne({ avatar_id: body.avatar });
    console.log('Found avatar document:', avatarDoc);
    const gender = avatarDoc ? avatarDoc.gender : undefined;
    // Get voice_id from DefaultVoice by gender
    let voice_id: string | undefined = undefined;
    if (gender) {
      const voiceDoc = await DefaultVoice.findOne({ gender });
      console.log('Found voice document:', voiceDoc);
      voice_id = voiceDoc ? voiceDoc.voice_id : undefined;
    }
    console.log('Using voice_id:', voice_id);
    const webhookData = {
      hook: body.hook,
      body: body.body,
      conclusion: body.conclusion,
      company_name: body.company_name,
      social_handles: body.social_handles,
      license: body.license,
      avatar: body.avatar,
      email: body.email,
      title: body.title,
      voice: voice_id,
      isDefault : avatarDoc?.default,
      timestamp: new Date().toISOString()
    };
    // Fire and forget: send request to n8n webhook and return immediately
    const https = require('https');
    const url = require('url');
    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(webhookData);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      port: parsedUrl.port || 443,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const webhookReq = https.request(options, (webhookRes: any) => {
      webhookRes.on('data', () => {}); // ignore data
      webhookRes.on('end', () => {
        console.log('N8n webhook request sent successfully, status:', webhookRes.statusCode);
      });
    });
    webhookReq.on('error', (error: any) => {
      console.error('N8n webhook request failed:', error);
    });
    webhookReq.write(postData);
    webhookReq.end();
    // Return immediately with request info
    const response = {
      success: true,
      message: 'Video generation started successfully',
      data: {
        status: 'processing',
        timestamp: new Date().toISOString(),
        estimated_completion: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        note: 'Video generation is running in the background. The video will be available when ready.'
      }
    };
    console.log('Returning response:', response);
    return res.json(response);
  } catch (error: any) {
    console.error('Error in video generation API:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: error.message || 'Unknown error occurred'
    });
  }
}