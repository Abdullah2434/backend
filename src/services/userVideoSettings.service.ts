import UserVideoSettings, {
  IUserVideoSettings,
} from "../models/UserVideoSettings";
import User from "../models/User";
import MusicTrack, { IMusicTrack } from "../models/MusicTrack";
import { MusicService } from "./music.service";
import { S3Service } from "./s3";
import {
  VoiceEnergyLevel,
  MusicEnergyLevel,
  VOICE_ENERGY_PRESETS,
} from "../constants/voiceEnergy";

export interface AvatarObject {
  avatar_id: string;
  avatarType: string;
}

export interface AvatarObject {
  avatar_id: string;
  avatarType: string;
}

export interface UserVideoSettingsData {
  prompt: string;
  avatar: string[];
  titleAvatar: AvatarObject | string;
  conclusionAvatar: AvatarObject | string;
  bodyAvatar?: AvatarObject | string;
  name: string;
  position: string;
  companyName: string;
  license: string;
  tailoredFit: string;
  socialHandles: string;
  city: string;
  preferredTone: string;
  callToAction: string;
  email: string;
  voiceEnergy?: VoiceEnergyLevel;
  musicEnergy?: MusicEnergyLevel;
  selectedMusicTrackId?: string;
  selectedVoiceId?: string;
  preset?: string;
  selectedVoicePreset?: string;
  selectedMusicPreset?: string;
  customVoiceMusic?: boolean;
}

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
    const user = await User.findOne({ email: data.email });
    if (!user) {
      throw new Error("User not found");
    }

    // Check if settings already exist for this user
    const existingSettings = await UserVideoSettings.findOne({
      userId: user._id,
    });

    if (existingSettings) {
      // Update existing settings
      const updatedSettings = await UserVideoSettings.findOneAndUpdate(
        { userId: user._id },
        {
          prompt: data.prompt,
          avatar: data.avatar,
          titleAvatar: data.titleAvatar,
          conclusionAvatar: data.conclusionAvatar,
          bodyAvatar: data.bodyAvatar,
          name: data.name,
          position: data.position,
          companyName: data.companyName,
          license: data.license,
          tailoredFit: data.tailoredFit,
          socialHandles: data.socialHandles,
          city: data.city,
          preferredTone: data.preferredTone,
          callToAction: data.callToAction,
          email: data.email,
          voiceEnergy: data.voiceEnergy,
          musicEnergy: data.musicEnergy,
          selectedMusicTrackId: data.selectedMusicTrackId,
          selectedVoiceId: data.selectedVoiceId,
          preset: data.preset,
          selectedVoicePreset: data.selectedVoicePreset,
          selectedMusicPreset: data.selectedMusicPreset,
          customVoiceMusic: data.customVoiceMusic,
        },
        { new: true, upsert: false }
      );

      if (!updatedSettings) {
        throw new Error("Failed to update user video settings");
      }

      return updatedSettings;
    } else {
      // Create new settings
      const newSettings = new UserVideoSettings({
        userId: user._id,
        email: data.email,
        prompt: data.prompt,
        avatar: data.avatar,
        titleAvatar: data.titleAvatar,
        conclusionAvatar: data.conclusionAvatar,
        bodyAvatar: data.bodyAvatar,
        name: data.name,
        position: data.position,
        companyName: data.companyName,
        license: data.license,
        tailoredFit: data.tailoredFit,
        socialHandles: data.socialHandles,
        city: data.city,
        preferredTone: data.preferredTone,
        callToAction: data.callToAction,
        voiceEnergy: data.voiceEnergy,
        musicEnergy: data.musicEnergy,
        selectedMusicTrackId: data.selectedMusicTrackId,
        selectedVoiceId: data.selectedVoiceId,
        preset: data.preset,
        selectedVoicePreset: data.selectedVoicePreset,
        selectedMusicPreset: data.selectedMusicPreset,
        customVoiceMusic: data.customVoiceMusic,
      });

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
    const user = await User.findOne({ email });
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
    const user = await User.findOne({ email });
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
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

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
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

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
      if (track && track.energyCategory === musicEnergy) {
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

    const voiceEnergy = settings.voiceEnergy || "mid";
    const musicEnergy = settings.musicEnergy || "mid";
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
    const user = await User.findOne({ email });
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
