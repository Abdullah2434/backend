import axios from 'axios';
import DefaultAvatar from '../models/avatar';
import { connectMongo } from '../config/mongoose';
import dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config();

const API_URL = `${process.env.HEYGEN_BASE_URL}/avatars`;
const API_KEY = process.env.HEYGEN_API_KEY;

/**
 * Sync HeyGen avatars with database
 * - Fetches avatar_ids from HeyGen API
 * - Compares with database avatars where:
 *   - default === false, OR
 *   - status === 'training' (regardless of default value)
 * - Deletes avatars that no longer exist in HeyGen
 */
export async function syncHeyGenAvatars() {
  try {
    await connectMongo();
    const response = await axios.get(API_URL, {
      headers: {
        accept: 'application/json',
        'x-api-key': API_KEY,
      },
    });

    // Extract avatar IDs from API response
    const videoAvatars = response.data.data?.avatars || [];
    const photoAvatars = response.data.data?.talking_photos || [];

    // Collect all avatar IDs from HeyGen API
    const heygenAvatarIds = new Set<string>();
    
    // Add video avatar IDs
    videoAvatars.forEach((avatar: any) => {
      if (avatar.avatar_id) {
        heygenAvatarIds.add(avatar.avatar_id);
      }
    });

    // Add photo avatar IDs
    photoAvatars.forEach((photo: any) => {
      if (photo.avatar_id) {
        heygenAvatarIds.add(photo.avatar_id);
      }
    });
    const avatarsToCheck = await DefaultAvatar.find({
      $or: [
        { default: false },
        { status: 'training' }
      ]
    });

    // Step 3: Compare and identify avatars to delete
    const avatarsToDelete: string[] = [];
    
    for (const avatar of avatarsToCheck) {
      // Check if avatar_id exists in HeyGen API response
      if (!heygenAvatarIds.has(avatar.avatar_id)) {
        avatarsToDelete.push(avatar.avatar_id);
      }
    }


    // Step 4: Delete avatars that no longer exist in HeyGen
    if (avatarsToDelete.length > 0) {
      
    
      const deleteResult = await DefaultAvatar.deleteMany({
        avatar_id: { $in: avatarsToDelete },
        $or: [
          { default: false },
          { status: 'training' }
        ]
      });

      avatarsToDelete.forEach((avatarId) => {
        const avatar = avatarsToCheck.find((a) => a.avatar_id === avatarId);
        const reason = avatar?.default === false ? 'default=false' : 'status=training';
      
      });
    } else {
      console.log('✅ No avatars to delete. All checked avatars exist in HeyGen.');
    }

    
    return {
      success: true,
      heygenAvatarCount: heygenAvatarIds.size,
      databaseAvatarCount: avatarsToCheck.length,
      deletedCount: avatarsToDelete.length,
      deletedAvatarIds: avatarsToDelete,
    };
  } catch (error: any) {

    if (error.response) {
      console.error('   API Response Status:', error.response.status);
      console.error('   API Response Data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Start cron job to sync HeyGen avatars every 12 hours
 */
export function startHeyGenAvatarSyncCron() {
  // Run every 12 hours: 3 */12 * * * (at minute 3 of every 12 hours)
  cron.schedule('3 */12 * * *', async () => {
    const startTime = Date.now();
    
    
    try {
      await syncHeyGenAvatars();
      const duration = Date.now() - startTime;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
    }
  });

}

// For manual run/testing
if (require.main === module) {
  syncHeyGenAvatars()
    .then((result) => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

