import UserVideoSettings, {
  IUserVideoSettings,
} from "../models/UserVideoSettings";
import MusicTrack, { IMusicTrack } from "../models/MusicTrack";
import { MusicService } from "./music.service";
import { S3Service } from "./s3";
import {
  VoiceEnergyLevel,
  MusicEnergyLevel,
  VOICE_ENERGY_PRESETS,
} from "../constants/voiceEnergy";
import { UserVideoSettingsData } from "../types/services/userVideoSettings.types";
import {
  findUserByEmail,
  findUserByEmailOrNull,
  buildUpdateData,
  buildNewSettingsData,
  getDefaultVoiceEnergy,
  getDefaultMusicEnergy,
  validateMusicTrackEnergy,
} from "../utils/userVideoSettingsHelpers";

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

      return updatedSettings;
    } else {
      // Create new settings
      const newSettingsData = buildNewSettingsData(user._id, data);
      const newSettings = new UserVideoSettings(newSettingsData);

      await newSettings.save();
      return newSettings;
    }
  }

  /**
   * Get user video settings by email
   */
  async getUserVideoSettings(
    email: string
  ): Promise<IUserVideoSettings | null> {
    const user = await findUserByEmailOrNull(email);
    if (!user) {
      return null;
    }

    return await UserVideoSettings.findOne({ userId: user._id });
  }

  /**
   * Get user video settings by userId
   */
  async getUserVideoSettingsByUserId(
    userId: string
  ): Promise<IUserVideoSettings | null> {
    return await UserVideoSettings.findOne({ userId });
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
    settings.musicEnergy = energyLevel;
    settings.customVoiceMusic = false;

    // Auto-assign random music track for the energy level
    const randomTrack = await this.musicService.getRandomTrackByEnergy(
      energyLevel
    );
    if (randomTrack) {
      settings.selectedMusicTrackId = randomTrack._id;
    }

    await settings.save();
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
    }

    return settings;
  }
}

export default UserVideoSettingsService;
