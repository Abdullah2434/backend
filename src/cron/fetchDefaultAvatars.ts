import axios from 'axios';
import DefaultAvatar from '../models/avatar';
import DefaultVoice from '../models/voice';
import dotenv from 'dotenv';
import { connectMongo } from '../config/mongoose';
dotenv.config();

const API_URL = `${process.env.HEYGEN_BASE_URL}/avatars`;
const API_KEY = process.env.HEYGEN_API_KEY;

export async function fetchAndStoreDefaultAvatars() {
  try {
    await connectMongo();
    const response = await axios.get(API_URL, {
      headers: {
        accept: 'application/json',
        'x-api-key': API_KEY,
      },
    });

    const videoAvatars = response.data.data?.avatars || [];
    const photoAvatars = response.data.data?.talking_photos || [];

    const allAvatars = [
      ...videoAvatars.map((a: any) => ({
        avatar_id: a.avatar_id,
        avatar_name: a.avatar_name || 'Unnamed Avatar',
        gender: a.gender || 'unknown',
        preview_image_url: a.preview_image_url,
        preview_video_url: a.preview_video_url || null,
        avatarType: 'video_avatar',
      })),
      ...photoAvatars.map((p: any) => ({
        avatar_id: p.talking_photo_id,
        avatar_name: p.talking_photo_name || 'Unnamed Avatar',
        gender: 'unknown',
        preview_image_url: p.preview_image_url,
        preview_video_url: null,
        avatarType: 'photo_avatar',
      })),
    ];

    for (const avatar of allAvatars) {
      const exists = await DefaultAvatar.findOne({ avatar_id: avatar.avatar_id });

      if (!exists) {
        await DefaultAvatar.create({
          ...avatar,
          default: true,
          status: 'ready',
        });
        console.log(`🆕 Added ${avatar.avatarType}: ${avatar.avatar_name}`);
      } else {
        await DefaultAvatar.updateOne(
          { avatar_id: avatar.avatar_id },
          {
            $set: {
              avatar_name: avatar.avatar_name,
              preview_image_url: avatar.preview_image_url,
              preview_video_url: avatar.preview_video_url,
              avatarType: avatar.avatarType,
            },
          }
        );
        console.log(`🔄 Updated ${avatar.avatarType}: ${avatar.avatar_name}`);
      }
    }

    console.log('✅ Default avatars sync complete.');
  } catch (error : any) {
    console.error('❌ Error fetching default avatars:', error.message);
  }
}

export async function fetchAndStoreDefaultVoices() {
  try {
    await connectMongo();
    const response = await axios.get(`${process.env.HEYGEN_BASE_URL}/voices`, {
      headers: {
        'accept': 'application/json',
        'x-api-key': process.env.HEYGEN_API_KEY,
      },
    });
    const voices = response.data.data?.voices || [];
    for (const voice of voices) {
      // Only create if preview_audio exists and is a non-empty string
      if (!voice.preview_audio) continue;
      const exists = await DefaultVoice.findOne({ voice_id: voice.voice_id });
      if (!exists) {
        await DefaultVoice.create({
          voice_id: voice.voice_id,
          language: voice.language,
          gender: voice.gender,
          name: voice.name,
          preview_audio: voice.preview_audio,
        });
      }
    }
    console.log('Default voices sync complete.');
  } catch (error) {
    console.error('Error fetching default voices:', error);
  }
}

// For manual run/testing
if (require.main === module) {
  fetchAndStoreDefaultAvatars();
}
