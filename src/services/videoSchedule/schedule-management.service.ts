import VideoSchedule, { IVideoSchedule } from "../../models/VideoSchedule";
import { generateRealEstateTrends } from "../trends.service";
import { VideoScheduleUtils } from "./utils.service";
import { ScheduleData } from "./types";

export class VideoScheduleManagement {
  /**
   * Get user's active schedule
   */
  async getUserSchedule(userId: string): Promise<IVideoSchedule | null> {
    return await VideoSchedule.findOne({ userId, isActive: true });
  }

  /**
   * Update schedule
   */
  async updateSchedule(
    scheduleId: string,
    userId: string,
    updateData: Partial<ScheduleData>
  ): Promise<IVideoSchedule | null> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found");
    }

    // If frequency or dates are changing, regenerate trends
    if (updateData.frequency || updateData.startDate || updateData.endDate) {
      const newScheduleData = {
        frequency: updateData.frequency || schedule.frequency,
        schedule: updateData.schedule || schedule.schedule,
        startDate: updateData.startDate || schedule.startDate,
        endDate: updateData.endDate || schedule.endDate,
        timezone: updateData.timezone || schedule.timezone,
      };

      VideoScheduleUtils.validateScheduleData(newScheduleData);

      const numberOfVideos = VideoScheduleUtils.calculateNumberOfVideos(
        newScheduleData.frequency,
        newScheduleData.startDate,
        newScheduleData.endDate
      );

      const trends = await generateRealEstateTrends();
      const selectedTrends = trends.slice(0, numberOfVideos);

      schedule.generatedTrends = VideoScheduleUtils.createScheduledTrends(
        selectedTrends,
        newScheduleData,
        newScheduleData.startDate,
        newScheduleData.endDate
      );
    }

    // Update other fields
    if (updateData.schedule) {
      schedule.schedule = updateData.schedule;
    }

    await schedule.save();
    return schedule;
  }

  /**
   * Deactivate schedule
   */
  async deactivateSchedule(
    scheduleId: string,
    userId: string
  ): Promise<boolean> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      return false;
    }

    schedule.isActive = false;
    await schedule.save();


    return true;
  }

  /**
   * Delete entire schedule
   */
  async deleteEntireSchedule(
    scheduleId: string,
    userId: string
  ): Promise<boolean> {
    const schedule = await VideoSchedule.findOne({
      _id: scheduleId,
      userId,
      isActive: true,
    });

    if (!schedule) {
      throw new Error("Schedule not found or not active");
    }

    // Delete the entire schedule document
    await VideoSchedule.findByIdAndDelete(scheduleId);

  

    return true;
  }
}

