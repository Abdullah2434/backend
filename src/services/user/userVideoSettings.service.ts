import UserVideoSettings, {
  IUserVideoSettings,
} from "../../models/UserVideoSettings";
import MusicTrack, { IMusicTrack } from "../../models/MusicTrack";
import { MusicService } from "../music";
import { S3Service } from "../s3.service";
import {
  VoiceEnergyLevel,
  MusicEnergyLevel,
  VOICE_ENERGY_PRESETS,
} from "../../constants/voiceEnergy";
import { UserVideoSettingsData } from "../../types/services/userVideoSettings.types";
import {
  findUserByEmail,
  findUserByEmailOrNull,
  buildUpdateData,
  buildNewSettingsData,
  getDefaultVoiceEnergy,
  getDefaultMusicEnergy,
  validateMusicTrackEnergy,
} from "../../utils/userVideoSettingsHelpers";
import { getCached, invalidateCache } from "../redis.service";

export class UserVideoSettingsService {
  private musicService: MusicService;

  constructor() {
    // Initialize S3 service and music service
    const s3Service = new S3Service({
      region: process.env.AWS_REGION || "us-east-1",
      bucketName: process.env.AWS_S3_BUCKET || "",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    });
    this.musicService = new MusicService(s3Service);
  }
  /**
   * Save or update user video settings
   */
  async saveUserVideoSettings(
    data: UserVideoSettingsData
  ): Promise<IUserVideoSettings> {
    // Find user by email to get userId
    const user = await findUserByEmail(data.email);

    // Check if settings already exist for this user
    const existingSettings = await UserVideoSettings.findOne({
      userId: user._id,
    });

    let result: IUserVideoSettings;

    if (existingSettings) {
      // Update existing settings
      const updateData = buildUpdateData(data);
      const updatedSettings = await UserVideoSettings.findOneAndUpdate(
        { userId: user._id },
        updateData,
        { new: true, upsert: false }
      );

      if (!updatedSettings) {
        throw new Error("Failed to update user video settings");
      }

      result = updatedSettings;
    } else {
      // Create new settings
      const newSettingsData = buildNewSettingsData(user._id, data);
      const newSettings = new UserVideoSettings(newSettingsData);

      await newSettings.save();
      result = newSettings;
    }

    // Invalidate cache after create/update
    await invalidateCache(`user_settings:${user._id.toString()}`);

    return result;
  }

  /**
   * Get user video settings by email
   * Cache key: user_settings:${userId}
   * TTL: 10 minutes (600 seconds)
   */
  async getUserVideoSettings(
    email: string
  ): Promise<IUserVideoSettings | null> {
    const user = await findUserByEmailOrNull(email);
    if (!user) {
      return null;
    }

    const userId = user._id.toString();
    const cacheKey = `user_settings:${userId}`;

    return getCached(
      cacheKey,
      async () => {
        return await UserVideoSettings.findOne({ userId: user._id });
      },
      600 // 10 minutes TTL
    );
  }

  /**
   * Get user video settings by userId
   * Cache key: user_settings:${userId}
   * TTL: 10 minutes (600 seconds)
   */
  async getUserVideoSettingsByUserId(
    userId: string
  ): Promise<IUserVideoSettings | null> {
    const cacheKey = `user_settings:${userId}`;

    return getCached(
      cacheKey,
      async () => {
        return await UserVideoSettings.findOne({ userId });
      },
      600 // 10 minutes TTL
    );
  }

  /**
   * Delete user video settings
   */
  async deleteUserVideoSettings(email: string): Promise<boolean> {
    const user = await findUserByEmailOrNull(email);
    if (!user) {
      return false;
    }

    const result = await UserVideoSettings.deleteOne({ userId: user._id });

    // Invalidate cache after deletion
    if (result.deletedCount > 0) {
      await invalidateCache(`user_settings:${user._id.toString()}`);
    }

    return result.deletedCount > 0;
  }

  /**
   * Check if user has saved video settings
   */
  async hasUserVideoSettings(email: string): Promise<boolean> {
    const settings = await this.getUserVideoSettings(email);
    return settings !== null;
  }

  /**
   * Set energy profile preset (updates both voice and music energy)
   */
  async setEnergyProfile(
    email: string,
    energyLevel: VoiceEnergyLevel
  ): Promise<IUserVideoSettings> {
    const user = await findUserByEmail(email);

    const settings = await UserVideoSettings.findOne({ userId: user._id });
    if (!settings) {
      throw new Error("User video settings not found");
    }

    // Update both voice and music energy
    settings.voiceEnergy = energyLevel;
    // Convert "medium" to "mid" for music energy (music only supports "high" | "mid" | "low")
    const musicEnergy: MusicEnergyLevel = energyLevel === "medium" ? "mid" : energyLevel;
    settings.musicEnergy = musicEnergy;
    settings.customVoiceMusic = false;

    // Auto-assign random music track for the energy level
    const randomTrack = await this.musicService.getRandomTrackByEnergy(
      musicEnergy
    );
    if (randomTrack) {
      settings.selectedMusicTrackId = randomTrack._id;
    }

    await settings.save();

    // Invalidate cache after update
    await invalidateCache(`user_settings:${user._id.toString()}`);

    return settings;
  }

  /**
   * Set custom voice and music settings independently
   */
  async setCustomVoiceMusic(
    email: string,
    voiceEnergy: VoiceEnergyLevel,
    musicEnergy: MusicEnergyLevel,
    selectedMusicTrackId?: string
  ): Promise<IUserVideoSettings> {
    const user = await findUserByEmail(email);

    const settings = await UserVideoSettings.findOne({ userId: user._id });
    if (!settings) {
      throw new Error("User video settings not found");
    }

    settings.voiceEnergy = voiceEnergy;
    settings.musicEnergy = musicEnergy;
    settings.customVoiceMusic = true;

    if (selectedMusicTrackId) {
      // Verify the track exists and matches the music energy
      const track = await MusicTrack.findById(selectedMusicTrackId);
      if (
        track &&
        validateMusicTrackEnergy(track.energyCategory, musicEnergy)
      ) {
        settings.selectedMusicTrackId = track._id;
      } else {
        throw new Error(
          "Selected music track does not match the music energy level"
        );
      }
    } else {
      // Auto-assign random track for the music energy level
      const randomTrack = await this.musicService.getRandomTrackByEnergy(
        musicEnergy
      );
      if (randomTrack) {
        settings.selectedMusicTrackId = randomTrack._id;
      }
    }

    await settings.save();

    // Invalidate cache after update
    await invalidateCache(`user_settings:${user._id.toString()}`);

    return settings;
  }

  /**
   * Get user's current energy profile settings
   */
  async getEnergyProfile(email: string): Promise<{
    voiceEnergy: VoiceEnergyLevel;
    musicEnergy: MusicEnergyLevel;
    selectedMusicTrack?: IMusicTrack;
    customVoiceMusic: boolean;
    voiceParams: any;
  } | null> {
    const settings = await this.getUserVideoSettings(email);
    if (!settings) return null;

    const voiceEnergy = settings.voiceEnergy || getDefaultVoiceEnergy();
    const musicEnergy = settings.musicEnergy || getDefaultMusicEnergy();
    const voiceParams = VOICE_ENERGY_PRESETS[voiceEnergy];

    let selectedMusicTrack: IMusicTrack | undefined;
    if (settings.selectedMusicTrackId) {
      const track = await MusicTrack.findById(settings.selectedMusicTrackId);
      selectedMusicTrack = track || undefined;
    }

    return {
      voiceEnergy,
      musicEnergy,
      selectedMusicTrack,
      customVoiceMusic: settings.customVoiceMusic || false,
      voiceParams,
    };
  }

  /**
   * Assign random music track based on music energy
   */
  async assignRandomMusicTrack(
    email: string,
    musicEnergy: MusicEnergyLevel
  ): Promise<IUserVideoSettings | null> {
    const user = await findUserByEmailOrNull(email);
    if (!user) return null;

    const settings = await UserVideoSettings.findOne({ userId: user._id });
    if (!settings) return null;

    const randomTrack = await this.musicService.getRandomTrackByEnergy(
      musicEnergy
    );
    if (randomTrack) {
      settings.selectedMusicTrackId = randomTrack._id;
      settings.musicEnergy = musicEnergy;
      await settings.save();

      // Invalidate cache after update
      await invalidateCache(`user_settings:${user._id.toString()}`);
    }

    return settings;
  }
}

export default UserVideoSettingsService;
