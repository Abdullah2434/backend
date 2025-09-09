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
        'accept': 'application/json',
        'x-api-key': API_KEY,
      },
    });
    const avatars = response.data.data?.avatars || [];
    for (const avatar of avatars) {
      const exists = await DefaultAvatar.findOne({ avatar_id: avatar.avatar_id });
      if (!exists) {
        await DefaultAvatar.create({
          avatar_id: avatar.avatar_id,
          avatar_name: avatar.avatar_name,
          gender: avatar.gender,
          preview_image_url: avatar.preview_image_url,
          preview_video_url: avatar.preview_video_url,
          default: true,
          status: 'ready',
        });
      }
    }
    console.log('Default avatars sync complete.');
  } catch (error) {
    console.error('Error fetching default avatars:', error);
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
