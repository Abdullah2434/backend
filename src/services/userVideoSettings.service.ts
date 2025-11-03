import UserVideoSettings, {
  IUserVideoSettings,
} from "../models/UserVideoSettings";
import User from "../models/User";

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
}

export class UserVideoSettingsService {
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
}

export default UserVideoSettingsService;
