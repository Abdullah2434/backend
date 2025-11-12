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
    console.log('🔄 Starting HeyGen avatar sync...');
    await connectMongo();

    // Step 1: Fetch avatars from HeyGen API
    console.log('📡 Fetching avatars from HeyGen API...');
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

    console.log(`✅ Found ${heygenAvatarIds.size} avatars in HeyGen API`);

    // Step 2: Fetch avatars from database where:
    // - default === false, OR
    // - status === 'training' (regardless of default value)
    console.log('📊 Fetching avatars from database...');
    const avatarsToCheck = await DefaultAvatar.find({
      $or: [
        { default: false },
        { status: 'training' }
      ]
    });
    console.log(`📊 Found ${avatarsToCheck.length} avatars to check (default === false OR status === 'training')`);

    // Step 3: Compare and identify avatars to delete
    const avatarsToDelete: string[] = [];
    
    for (const avatar of avatarsToCheck) {
      // Check if avatar_id exists in HeyGen API response
      if (!heygenAvatarIds.has(avatar.avatar_id)) {
        avatarsToDelete.push(avatar.avatar_id);
      }
    }

    console.log(`🔍 Comparison complete: ${avatarsToDelete.length} avatars to delete`);

    // Step 4: Delete avatars that no longer exist in HeyGen
    if (avatarsToDelete.length > 0) {
      console.log(`🗑️  Deleting ${avatarsToDelete.length} avatars that no longer exist in HeyGen...`);
      
      const deleteResult = await DefaultAvatar.deleteMany({
        avatar_id: { $in: avatarsToDelete },
        $or: [
          { default: false },
          { status: 'training' }
        ]
      });

      console.log(`✅ Deleted ${deleteResult.deletedCount} avatar(s):`);
      avatarsToDelete.forEach((avatarId) => {
        const avatar = avatarsToCheck.find((a) => a.avatar_id === avatarId);
        const reason = avatar?.default === false ? 'default=false' : 'status=training';
        console.log(`   - ${avatar?.avatar_name || avatarId} (${avatarId}) [${reason}]`);
      });
    } else {
      console.log('✅ No avatars to delete. All checked avatars exist in HeyGen.');
    }

    console.log('✅ HeyGen avatar sync complete.');
    
    return {
      success: true,
      heygenAvatarCount: heygenAvatarIds.size,
      databaseAvatarCount: avatarsToCheck.length,
      deletedCount: avatarsToDelete.length,
      deletedAvatarIds: avatarsToDelete,
    };
  } catch (error: any) {
    console.error('❌ Error syncing HeyGen avatars:', error.message);
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
    console.log(`⏰ HeyGen avatar sync cron job started at ${new Date().toISOString()}`);
    
    try {
      await syncHeyGenAvatars();
      const duration = Date.now() - startTime;
      console.log(`✅ HeyGen avatar sync cron job completed in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ HeyGen avatar sync cron job failed after ${duration}ms:`, error.message);
    }
  });

  console.log('⏰ HeyGen avatar sync cron job started - running every 12 hours');
}

// For manual run/testing
if (require.main === module) {
  syncHeyGenAvatars()
    .then((result) => {
      console.log('Sync result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}

