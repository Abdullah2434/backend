import DefaultAvatar from '../models/avatar';
import axios from 'axios';
import dotenv from 'dotenv';
import { connectMongo } from '../config/mongoose';
dotenv.config();

const API_KEY = process.env.HEYGEN_API_KEY;
const STATUS_URL = `${process.env.HEYGEN_BASE_URL}/photo_avatar/train/status`;

export async function checkPendingAvatarsAndUpdate() {
  try {

    await connectMongo();
    const pendingAvatars = await DefaultAvatar.find({ status: 'pending' });
    for (const avatar of pendingAvatars) {
      const avatarId = avatar.avatar_id;
      const response = await axios.get(`${STATUS_URL}/${avatarId}`, {
        headers: {
          'accept': 'application/json',
          'X-Api-Key': API_KEY,
        },
      });
      const status = response.data?.data?.status;
      if (status === 'ready') {
        avatar.status = 'ready';
        await avatar.save();
        console.log(`Avatar ${avatarId} is now ready.`);
      }
    }
  } catch (error) {
    console.error('Error checking avatar status:', error);
  }
}

// For manual run/testing
if (require.main === module) {
  checkPendingAvatarsAndUpdate();
}
