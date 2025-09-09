import { Worker } from 'bullmq';
import axios from 'axios';
import DefaultAvatar from '../models/avatar';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { photoAvatarQueue } from './photoAvatarQueue';
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
  const { imagePath, age_group, name, gender, userId, ethnicity } = job.data;
  try {
    // 1. Upload image to HeyGen
    const imageBuffer = fs.readFileSync(imagePath);
    const uploadRes = await axios.post(UPLOAD_URL, imageBuffer, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'image/jpeg',
      },
    });
    const image_key = uploadRes.data.data.image_key;
    // 2. Create avatar group
    const groupRes = await axios.post(AVATAR_GROUP_URL, {
      name,
      image_key,
    }, {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
      }
    });
    const avatar_id = groupRes.data.data.id;
    const group_id = groupRes.data.data.group_id;
    const preview_image_url = groupRes.data.data.image_url;    
    // Wait 20 seconds before training
    await new Promise(r => setTimeout(r, 20000));
    // 3. Train avatar group
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
    return true;
  } catch (error) {
    console.error('Photo avatar worker error:', error);
    // Cleanup temp image
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    throw error;
  }
}, { connection: redisConnection });
