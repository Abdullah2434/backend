import { Worker } from 'bullmq';
import axios from 'axios';
import DefaultAvatar from '../models/avatar';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { photoAvatarQueue } from './photoAvatarQueue';
import { notificationService } from '../services/notification.service';
dotenv.config();

const API_KEY = process.env.HEYGEN_API_KEY;
const UPLOAD_URL = 'https://upload.heygen.com/v1/asset';
const AVATAR_GROUP_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/avatar_group/create`;
const TRAIN_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/train`;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

export const worker = new Worker('photo-avatar', async job => {
  const { imagePath, age_group, name, gender, userId, ethnicity, mimeType } = job.data;
  
  try {
    // Notify user that processing has started
    notificationService.notifyPhotoAvatarProgress(userId, 'upload', 'progress', {
      message: 'Uploading your photo to HeyGen...'
    });

    // 1. Upload image to HeyGen
    const imageBuffer = fs.readFileSync(imagePath);
    const uploadRes = await axios.post(UPLOAD_URL, imageBuffer, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': mimeType || 'image/jpeg',
      },
    });
    const image_key = uploadRes.data?.data?.image_key;
    if (!image_key) {
      console.error('HeyGen image upload failed, no image_key returned:', uploadRes.data);
      notificationService.notifyPhotoAvatarProgress(userId, 'upload', 'error', {
        message: 'Failed to upload image to HeyGen. Please try again.',
        error: 'No image_key returned from HeyGen'
      });
      throw new Error('HeyGen image upload failed, no image_key returned');
    }

    // Notify successful upload
    notificationService.notifyPhotoAvatarProgress(userId, 'upload', 'success', {
      message: 'Image uploaded successfully!'
    });

    // 2. Create avatar group
    const groupPayload = {
      name,
      image_key,
    };

    notificationService.notifyPhotoAvatarProgress(userId, 'group-creation', 'progress', {
      message: 'Creating avatar group...'
    });

    try {
      const groupRes = await axios.post(AVATAR_GROUP_URL, groupPayload, {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Key': API_KEY,
        }
      });
      const avatar_id = groupRes.data.data.id;
      const group_id = groupRes.data.data.group_id;
      const preview_image_url = groupRes.data.data.image_url;

      notificationService.notifyPhotoAvatarProgress(userId, 'group-creation', 'success', {
        message: 'Avatar group created successfully!'
      });

      // Wait 20 seconds before training
      notificationService.notifyPhotoAvatarProgress(userId, 'training', 'progress', {
        message: 'Preparing to train your avatar (this may take a few minutes)...'
      });
      
      await new Promise(r => setTimeout(r, 20000));

      // 3. Train avatar group
      notificationService.notifyPhotoAvatarProgress(userId, 'training', 'progress', {
        message: 'Training your avatar with AI...'
      });

      const response = await axios.post(TRAIN_URL, {
        group_id,
      }, {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Key': API_KEY,
        }
      });

      console.log('Train response:', response.data);

      // 4. Save custom avatar in DB
      notificationService.notifyPhotoAvatarProgress(userId, 'saving', 'progress', {
        message: 'Saving your avatar...'
      });

      await DefaultAvatar.create({
        avatar_id: avatar_id,
        avatar_name: name,
        gender,
        preview_image_url,
        preview_video_url: '',
        default: false,
        userId,
        ethnicity,
        status: 'pending',
        age_group,
      });

      // Cleanup temp image
      fs.unlinkSync(imagePath);

      // Final success notification
      notificationService.notifyPhotoAvatarProgress(userId, 'complete', 'success', {
        message: 'Your custom avatar has been created successfully!',
        avatarId: avatar_id,
        previewImageUrl: preview_image_url
      });

      return true;
    } catch (groupErr) {
      // Enhanced error logging for HeyGen API
      if (typeof groupErr === 'object' && groupErr !== null && 'response' in groupErr) {
        const errObj = groupErr as any;
        console.error('HeyGen avatar group creation failed:', {
          status: errObj.response?.status,
          data: errObj.response?.data,
          payload: groupPayload,
        });

        // Notify user about specific error
        let errorMessage = 'Failed to create avatar group. Please try again.';
        if (errObj.response?.status === 400) {
          errorMessage = 'Invalid image format or size. Please use a clear photo of a person.';
        } else if (errObj.response?.status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        }

        notificationService.notifyPhotoAvatarProgress(userId, 'group-creation', 'error', {
          message: errorMessage,
          error: errObj.response?.data?.message || 'Avatar group creation failed'
        });
      } else {
        console.error('HeyGen avatar group creation error:', groupErr);
        notificationService.notifyPhotoAvatarProgress(userId, 'group-creation', 'error', {
          message: 'Failed to create avatar group. Please try again.',
          error: 'Unknown error occurred'
        });
      }
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      throw groupErr;
    }
  } catch (error) {
    console.error('Photo avatar worker error:', error);
    
    // Notify user about general error
    notificationService.notifyPhotoAvatarProgress(userId, 'error', 'error', {
      message: 'Failed to create your custom avatar. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });

    // Cleanup temp image
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    throw error;
  }
}, { connection: redisConnection });
