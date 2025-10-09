import VideoSchedule, { IVideoSchedule } from "../models/VideoSchedule";
import UserVideoSettings from "../models/UserVideoSettings";
import { generateRealEstateTrends } from "./trends.service";
import { VideoService } from "../modules/video/services/video.service";
import ScheduleEmailService, {
  ScheduleEmailData,
  VideoGeneratedEmailData,
} from "./scheduleEmail.service";
import CaptionGenerationService from "./captionGeneration.service";
import TimezoneService from "../utils/timezone";
import { notificationService } from "./notification.service";

export interface ScheduleData {
  frequency: "once_week" | "twice_week" | "three_week" | "daily";
  schedule: {
    days: string[];
    times: string[];
  };
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export class VideoScheduleService {
  private videoService = new VideoService();
  private emailService = new ScheduleEmailService();

  /**
   * Create a new video schedule (automatically set to one month duration)
   */
  async createSchedule(
    userId: string,
    email: string,
    scheduleData: ScheduleData
  ): Promise<IVideoSchedule> {
    // Validate schedule data
    this.validateScheduleData(scheduleData);

    // Check if user already has an active schedule
    const existingSchedule = await VideoSchedule.findOne({
      userId,
      isActive: true,
    });

    if (existingSchedule) {
      throw new Error("User already has an active video schedule");
    }

    // Get user video settings
    const userSettings = await UserVideoSettings.findOne({ userId });
    if (!userSettings) {
      throw new Error(
        "User video settings not found. Please complete your profile first."
      );
    }

    // Set default duration to one month from start date
    const startDate = new Date(scheduleData.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // Add one month

    // Calculate number of videos needed for one month
    const numberOfVideos = this.calculateNumberOfVideos(
      scheduleData.frequency,
      startDate,
      endDate
    );

    // Generate trends for the schedule - ensure we have enough for the full month
    console.log(`🎬 Generating ${numberOfVideos} trends for the schedule...`);
    const trends = await generateRealEstateTrends();

    // If we don't have enough trends, generate more
    let selectedTrends = trends;
    if (trends.length < numberOfVideos) {
      console.log(
        `⚠️ Not enough trends (${trends.length}), generating more...`
      );
      // Generate additional trends to meet the requirement
      const additionalTrends = await generateRealEstateTrends();
      selectedTrends = [...trends, ...additionalTrends];
    }

    selectedTrends = selectedTrends.slice(0, numberOfVideos);
    console.log(`✅ Selected ${selectedTrends.length} trends for scheduling`);

    // Create scheduled trends
    const generatedTrends = this.createScheduledTrends(
      selectedTrends,
      scheduleData,
      startDate,
      endDate
    );

    // Create the schedule
    const schedule = new VideoSchedule({
      userId,
      email,
      timezone: scheduleData.timezone,
      frequency: scheduleData.frequency,
      schedule: scheduleData.schedule,
      isActive: true,
      startDate: startDate,
      endDate: endDate,
      generatedTrends,
    });

    await schedule.save();

    // Send schedule created email
    try {
      const emailData: ScheduleEmailData = {
        userEmail: email,
        scheduleId: schedule._id.toString(),
        frequency: scheduleData.frequency,
        startDate: startDate,
        endDate: endDate,
        totalVideos: numberOfVideos,
        schedule: scheduleData.schedule,
        videos: generatedTrends.map((trend) => ({
          description: trend.description,
          keypoints: trend.keypoints,
          scheduledFor: trend.scheduledFor,
          status: trend.status,
        })),
      };

      await this.emailService.sendScheduleCreatedEmail(emailData);
    } catch (emailError) {
      console.error("Error sending schedule created email:", emailError);
      // Don't fail the schedule creation if email fails
    }

    // Log success (no WebSocket notification)
    console.log(
      `✅ Video schedule created for user ${userId}: ${numberOfVideos} videos scheduled`
    );

    return schedule;
  }

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

      this.validateScheduleData(newScheduleData);

      const numberOfVideos = this.calculateNumberOfVideos(
        newScheduleData.frequency,
        newScheduleData.startDate,
        newScheduleData.endDate
      );

      const trends = await generateRealEstateTrends();
      const selectedTrends = trends.slice(0, numberOfVideos);

      schedule.generatedTrends = this.createScheduledTrends(
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

    // Log deactivation (no WebSocket notification)
    console.log(`✅ Video schedule deactivated for user ${userId}`);

    return true;
  }

  /**
   * Get pending videos for processing
   */
  async getPendingVideos(): Promise<IVideoSchedule[]> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    return await VideoSchedule.find({
      isActive: true,
      "generatedTrends.scheduledFor": {
        $gte: now,
        $lte: oneHourFromNow,
      },
      "generatedTrends.status": "pending",
    });
  }

  /**
   * Process scheduled video
   */
  async processScheduledVideo(
    scheduleId: string,
    trendIndex: number,
    userSettings: any
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    const trend = schedule.generatedTrends[trendIndex];
    if (!trend) {
      throw new Error("Trend not found");
    }

    // Update status to processing
    schedule.generatedTrends[trendIndex].status = "processing";
    await schedule.save();

    // Send socket notification - Video processing started
    notificationService.notifyScheduledVideoProgress(
      schedule.userId.toString(),
      "video-creation",
      "progress",
      {
        message: `Scheduled video "${trend.description}" is being created`,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
        videoTitle: trend.description,
      }
    );

    try {
      // Generate social media captions using OpenAI
      console.log("🎨 Generating social media captions...");
      const captions =
        await CaptionGenerationService.generateScheduledVideoCaptions(
          trend.description,
          trend.keypoints,
          {
            name: userSettings.name,
            position: userSettings.position,
            companyName: userSettings.companyName,
            city: userSettings.city,
            socialHandles: userSettings.socialHandles,
          }
        );
      console.log("✅ Captions generated successfully");

      // Create video using existing video generation logic (NO CAPTIONS in webhook)
      const videoData = {
        hook: trend.description,
        body: trend.keypoints,
        conclusion:
          "Contact us for more information about real estate opportunities.",
        company_name: userSettings.companyName,
        social_handles: userSettings.socialHandles,
        license: userSettings.license,
        avatar_title: userSettings.titleAvatar,
        avatar_body: userSettings.avatar[0] || userSettings.avatar[0],
        avatar_conclusion: userSettings.conclusionAvatar,
        email: userSettings.email,
        title: trend.description,
        // Store captions for later retrieval (not sent to webhook)
        _captions: captions,
      };

      // ==================== STEP 1: CREATE VIDEO (PROMPT GENERATION) ====================
      console.log("🎬 Step 1: Creating video (prompt generation)...");
      console.log("📋 API Endpoint: POST /api/video/create");

      // Get gender from avatar settings
      const DefaultAvatar = require("../models/avatar").default;
      const avatarDoc = await DefaultAvatar.findOne({
        avatar_id: userSettings.titleAvatar,
      });
      const gender = avatarDoc ? avatarDoc.gender : undefined;

      // Get voice_id from gender
      let voice_id: string | undefined = undefined;
      if (gender) {
        const DefaultVoice = require("../models/voice").default;
        const voiceDoc = await DefaultVoice.findOne({ gender });
        voice_id = voiceDoc ? voiceDoc.voice_id : undefined;
      }

      // Step 1: Prepare data for video creation API (same format as manual)
      const videoCreationData = {
        prompt: userSettings.prompt,
        avatar: userSettings.avatar,
        name: userSettings.name,
        position: userSettings.position,
        companyName: userSettings.companyName,
        license: userSettings.license,
        tailoredFit: userSettings.tailoredFit,
        socialHandles: userSettings.socialHandles,
        videoTopic: trend.description,
        topicKeyPoints: trend.keypoints,
        city: userSettings.city,
        preferredTone: userSettings.preferredTone,
        zipCode: 90014,
        zipKeyPoints: "new bars and restaurants",
        callToAction: userSettings.callToAction,
        email: userSettings.email,
        timestamp: new Date().toISOString(),
        requestId: `scheduled_video_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        isScheduled: true,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
      };

      // Call Step 1: Create Video API endpoint (same as manual)
      console.log("🔄 Step 1: Calling Create Video API...");
      console.log(
        "📋 Request Body:",
        JSON.stringify(videoCreationData, null, 2)
      );

      let enhancedContent: any = null;
      try {
        enhancedContent = await this.callCreateVideoAPI(videoCreationData);
        console.log("✅ Step 1: Create Video API completed successfully");
        console.log(
          "📋 Enhanced content received:",
          JSON.stringify(enhancedContent, null, 2)
        );

        // Validate that we have the required enhanced content
        if (
          !enhancedContent ||
          !enhancedContent.hook ||
          !enhancedContent.body ||
          !enhancedContent.conclusion
        ) {
          throw new Error(
            "Enhanced content is incomplete or missing from first API response"
          );
        }
      } catch (error: any) {
        console.error("❌ Step 1: Create Video API failed:", error);
        throw new Error(`Create Video API failed: ${error.message}`);
      }

      // Wait a moment between API calls
      console.log("⏳ Waiting 2 seconds before Step 2...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // ==================== STEP 2: GENERATE VIDEO (VIDEO CREATION) ====================
      console.log("🎬 Step 2: Generating video (video creation)...");
      console.log("📋 API Endpoint: POST /api/video/generate-video");

      // Step 2: Prepare data for video generation API using ONLY enhanced content from Step 1
      const videoGenerationData = {
        hook: enhancedContent.hook, // ONLY use enhanced hook from Step 1
        body: enhancedContent.body, // ONLY use enhanced body from Step 1
        conclusion: enhancedContent.conclusion, // ONLY use enhanced conclusion from Step 1
        company_name: userSettings.companyName,
        social_handles: userSettings.socialHandles,
        license: userSettings.license,
        avatar_title: userSettings.titleAvatar,
        avatar_body: userSettings.avatar[0] || userSettings.avatar[0],
        avatar_conclusion: userSettings.conclusionAvatar,
        email: userSettings.email,
        title: trend.description,
        voice: voice_id,
        isDefault: avatarDoc?.default,
        timestamp: new Date().toISOString(),
        isScheduled: true,
        scheduleId: scheduleId,
        trendIndex: trendIndex,
        // Store captions for later retrieval (not sent to webhook)
        _captions: captions,
      };

      // Call Step 2: Generate Video API endpoint (same as manual)
      console.log("🔄 Step 2: Calling Generate Video API...");
      console.log(
        "📋 Request Body:",
        JSON.stringify(videoGenerationData, null, 2)
      );
      try {
        await this.callGenerateVideoAPI(videoGenerationData);
        console.log("✅ Step 2: Generate Video API completed successfully");
      } catch (error: any) {
        console.error("❌ Step 2: Generate Video API failed:", error);
        throw new Error(`Generate Video API failed: ${error.message}`);
      }

      // Log processing completion
      console.log("🎉 Both API calls completed successfully!");
      console.log(
        `🎬 Scheduled video processing initiated: "${trend.description}" for user ${schedule.userId}`
      );
      console.log(
        "📱 Video will be processed and auto-posted to social media when ready"
      );

      // Send socket notification - Video creation initiated successfully
      notificationService.notifyScheduledVideoProgress(
        schedule.userId.toString(),
        "video-creation",
        "success",
        {
          message: `Video "${trend.description}" creation initiated successfully`,
          scheduleId: scheduleId,
          trendIndex: trendIndex,
          videoTitle: trend.description,
          nextStep: "Video will be processed and auto-posted when ready",
        }
      );
    } catch (error: any) {
      console.error("Error processing scheduled video:", error);
      schedule.generatedTrends[trendIndex].status = "failed";
      await schedule.save();

      // Send socket notification - Video creation failed
      notificationService.notifyScheduledVideoProgress(
        schedule.userId.toString(),
        "video-creation",
        "error",
        {
          message: `Failed to create video "${trend.description}": ${error.message}`,
          scheduleId: scheduleId,
          trendIndex: trendIndex,
          videoTitle: trend.description,
          error: error.message,
        }
      );

      // Log failure
      console.error(
        `❌ Failed to process scheduled video "${trend.description}" for user ${schedule.userId}:`,
        error.message
      );
    }
  }

  /**
   * Call Step 1: Create Video API endpoint (same as manual)
   */
  private async callCreateVideoAPI(data: any): Promise<any> {
    const baseUrl = process.env.API_BASE_URL || "https://backend.edgeairealty.com";
    const createVideoUrl = `${baseUrl}/api/video/create`;

    console.log("🌐 Making API call to create video...");
    console.log(`📋 URL: ${createVideoUrl}`);
    console.log(`📋 Method: POST`);
    console.log(`📋 Headers: Content-Type: application/json`);

    return new Promise<any>((resolve, reject) => {
      const https = require("https");
      const http = require("http");
      const url = require("url");
      const parsedUrl = url.parse(createVideoUrl);
      const postData = JSON.stringify(data);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const request = (parsedUrl.protocol === "https:" ? https : http).request(
        options,
        (res: any) => {
          let responseData = "";
          res.on("data", (chunk: any) => {
            responseData += chunk;
          });
          res.on("end", () => {
            console.log(
              `📋 Step 1: Create Video API Response Status: ${res.statusCode}`
            );
            console.log(
              `📋 Step 1: Create Video API Response Body:`,
              responseData
            );

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log("✅ Step 1: Create Video API called successfully");

              // Parse the response to extract enhanced content
              try {
                const response = JSON.parse(responseData);

                // Extract enhanced content from webhookResponse (URL-encoded)
                const webhookResponse = response.data?.webhookResponse;
                if (webhookResponse) {
                  const enhancedContent = {
                    hook: decodeURIComponent(webhookResponse.hook || "")
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                    body: decodeURIComponent(webhookResponse.body || "")
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                    conclusion: decodeURIComponent(
                      webhookResponse.conclusion || ""
                    )
                      .replace(/\\n\\n/g, " ")
                      .replace(/\n\n/g, " ")
                      .replace(/\\n/g, " ")
                      .replace(/\n/g, " ")
                      .trim(),
                  };
                  console.log(
                    "📋 Extracted enhanced content:",
                    enhancedContent
                  );
                  resolve(enhancedContent);
                } else {
                  console.warn("⚠️ No webhookResponse found in API response");
                  resolve(null);
                }
              } catch (parseError) {
                console.warn(
                  "⚠️ Could not parse enhanced content from response, using fallback"
                );
                resolve(null);
              }
            } else {
              console.error(
                `❌ Step 1: Create Video API failed with status ${res.statusCode}:`,
                responseData
              );
              reject(new Error(`Create Video API failed: ${res.statusCode}`));
            }
          });
        }
      );

      request.on("error", (error: any) => {
        console.error("❌ Step 1: Create Video API request failed:", error);
        console.error(`📋 Error details: ${error.message}`);
        console.error(`📋 Error code: ${error.code}`);
        reject(error);
      });

      request.write(postData);
      request.end();
    });
  }

  /**
   * Call Step 2: Generate Video API endpoint (same as manual)
   */
  private async callGenerateVideoAPI(data: any): Promise<void> {
    const baseUrl = process.env.API_BASE_URL || "https://backend.edgeairealty.com";
    const generateVideoUrl = `${baseUrl}/api/video/generate-video`;

    console.log("🌐 Making API call to generate video...");
    console.log(`📋 URL: ${generateVideoUrl}`);
    console.log(`📋 Method: POST`);
    console.log(`📋 Headers: Content-Type: application/json`);

    return new Promise<void>((resolve, reject) => {
      const https = require("https");
      const http = require("http");
      const url = require("url");
      const parsedUrl = url.parse(generateVideoUrl);
      const postData = JSON.stringify(data);

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const request = (parsedUrl.protocol === "https:" ? https : http).request(
        options,
        (res: any) => {
          let responseData = "";
          res.on("data", (chunk: any) => {
            responseData += chunk;
          });
          res.on("end", () => {
            console.log(
              `📋 Step 2: Generate Video API Response Status: ${res.statusCode}`
            );
            console.log(
              `📋 Step 2: Generate Video API Response Body:`,
              responseData
            );

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log("✅ Step 2: Generate Video API called successfully");
              resolve();
            } else {
              console.error(
                `❌ Step 2: Generate Video API failed with status ${res.statusCode}:`,
                responseData
              );
              reject(new Error(`Generate Video API failed: ${res.statusCode}`));
            }
          });
        }
      );

      request.on("error", (error: any) => {
        console.error("❌ Step 2: Generate Video API request failed:", error);
        console.error(`📋 Error details: ${error.message}`);
        console.error(`📋 Error code: ${error.code}`);
        reject(error);
      });

      request.write(postData);
      request.end();
    });
  }

  /**
   * Update video status after processing
   */
  async updateVideoStatus(
    scheduleId: string,
    trendIndex: number,
    status: "completed" | "failed",
    videoId?: string
  ): Promise<void> {
    const schedule = await VideoSchedule.findById(scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    if (schedule.generatedTrends[trendIndex]) {
      schedule.generatedTrends[trendIndex].status = status;
      if (videoId) {
        schedule.generatedTrends[trendIndex].videoId = videoId;
      }
      await schedule.save();

      const trend = schedule.generatedTrends[trendIndex];

      // Send email notification for completed videos
      if (status === "completed") {
        try {
          // Check if this is the last video in the schedule
          const completedVideos = schedule.generatedTrends.filter(
            (t: any) => t.status === "completed"
          ).length;
          const totalVideos = schedule.generatedTrends.length;
          const isLastVideo = completedVideos === totalVideos;

          const emailData: VideoGeneratedEmailData = {
            userEmail: schedule.email,
            scheduleId: schedule._id.toString(),
            videoTitle: trend.description,
            videoDescription: trend.description,
            videoKeypoints: trend.keypoints,
            generatedAt: new Date(),
            videoId: videoId,
            isLastVideo: isLastVideo,
          };

          await this.emailService.sendVideoGeneratedEmail(emailData);
        } catch (emailError) {
          console.error("Error sending video generated email:", emailError);
          // Don't fail the status update if email fails
        }
      }

      // Log status update (no WebSocket notification)
      const statusMessage =
        status === "completed"
          ? `✅ Scheduled video "${trend.description}" completed for user ${schedule.userId}`
          : `❌ Scheduled video "${trend.description}" failed for user ${schedule.userId}`;

      console.log(statusMessage);
    }
  }

  /**
   * Validate schedule data
   */
  private validateScheduleData(scheduleData: ScheduleData): void {
    const { frequency, schedule } = scheduleData;

    // Validate frequency-specific requirements
    switch (frequency) {
      case "once_week":
        if (schedule.days.length !== 1 || schedule.times.length !== 1) {
          throw new Error("Once a week requires exactly 1 day and 1 time");
        }
        break;
      case "twice_week":
        if (schedule.days.length !== 2 || schedule.times.length !== 2) {
          throw new Error("Twice a week requires exactly 2 days and 2 times");
        }
        break;
      case "three_week":
        if (schedule.days.length !== 3 || schedule.times.length !== 3) {
          throw new Error(
            "Three times a week requires exactly 3 days and 3 times"
          );
        }
        break;
      case "daily":
        if (schedule.days.length !== 0 || schedule.times.length !== 1) {
          throw new Error("Daily requires exactly 1 time and no specific days");
        }
        break;
    }

    // Validate time format
    schedule.times.forEach((time) => {
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        throw new Error(`Invalid time format: ${time}. Use HH:MM format.`);
      }
    });

    // Validate days
    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    schedule.days.forEach((day) => {
      if (!validDays.includes(day)) {
        throw new Error(`Invalid day: ${day}`);
      }
    });
  }

  /**
   * Calculate number of videos needed based on frequency and duration
   * Ensures we calculate for the full month period
   */
  private calculateNumberOfVideos(
    frequency: string,
    startDate: Date,
    endDate: Date
  ): number {
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weeks = Math.ceil(daysDiff / 7);

    console.log(`📊 Calculating videos for ${frequency}:`);
    console.log(
      `📅 Period: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );
    console.log(`📅 Days: ${daysDiff}, Weeks: ${weeks}`);

    let numberOfVideos = 0;

    switch (frequency) {
      case "once_week":
        numberOfVideos = weeks;
        console.log(`📊 Once per week: ${numberOfVideos} videos`);
        break;
      case "twice_week":
        numberOfVideos = weeks * 2;
        console.log(`📊 Twice per week: ${numberOfVideos} videos`);
        break;
      case "three_week":
        numberOfVideos = weeks * 3;
        console.log(`📊 Three times per week: ${numberOfVideos} videos`);
        break;
      case "daily":
        numberOfVideos = daysDiff;
        console.log(`📊 Daily: ${numberOfVideos} videos`);
        break;
      default:
        numberOfVideos = 1;
        console.log(`📊 Default: ${numberOfVideos} videos`);
    }

    console.log(`📊 Total videos to generate: ${numberOfVideos}`);
    return numberOfVideos;
  }

  /**
   * Create scheduled trends with proper timing
   * Handles edge case: if scheduled time is less than 40 minutes away, skip that day
   */
  private createScheduledTrends(
    trends: any[],
    scheduleData: ScheduleData,
    startDate: Date,
    endDate: Date
  ): any[] {
    const scheduledTrends = [];
    const { frequency, schedule } = scheduleData;

    let currentDate = new Date(startDate);
    let trendIndex = 0;
    const now = new Date();

    console.log(
      `📅 Creating scheduled trends from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );
    console.log(`🕐 Current time: ${now.toISOString()}`);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();

      // Check if this day should have a video
      let shouldSchedule = false;
      let timeIndex = 0;

      if (frequency === "daily") {
        shouldSchedule = true;
        timeIndex = 0;
      } else {
        const dayIndex = schedule.days.findIndex(
          (day) => day.toLowerCase() === dayOfWeek
        );
        if (dayIndex !== -1) {
          shouldSchedule = true;
          timeIndex = dayIndex;
        }
      }

      if (shouldSchedule) {
        const [hours, minutes] = schedule.times[timeIndex]
          .split(":")
          .map(Number);

        // Create scheduled time in the user's timezone first
        const scheduledTime = new Date(currentDate);
        scheduledTime.setHours(hours, minutes, 0, 0);

        // Convert to UTC using the user's timezone
        const timeString = `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}`;
        const scheduledTimeUTC = TimezoneService.convertToUTC(
          timeString,
          scheduleData.timezone
        );

        console.log(
          `🕐 Converting ${timeString} ${scheduleData.timezone} to UTC:`,
          scheduledTimeUTC.toISOString()
        );

        // Use the UTC time for scheduling
        const finalScheduledTime = new Date(currentDate);
        finalScheduledTime.setUTCHours(
          scheduledTimeUTC.getUTCHours(),
          scheduledTimeUTC.getUTCMinutes(),
          0,
          0
        );

        console.log(
          `📅 Final scheduled time (UTC):`,
          finalScheduledTime.toISOString()
        );

        // Edge case handling: Check if scheduled time is less than 40 minutes away
        const shouldSkipDay = this.shouldSkipScheduledDay(
          finalScheduledTime,
          now,
          dayOfWeek,
          schedule.times[timeIndex]
        );

        if (shouldSkipDay) {
          // Skip this day, move to next day
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Use trend with cycling if we run out of trends
        const trendToUse = trends[trendIndex % trends.length];

        scheduledTrends.push({
          ...trendToUse,
          scheduledFor: finalScheduledTime, // Use UTC time
          status: "pending",
        });

        trendIndex++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(
      `📊 Created ${scheduledTrends.length} scheduled trends for the full month period`
    );
    console.log(`📊 Used ${trends.length} unique trends with cycling`);
    return scheduledTrends;
  }

  /**
   * Check if a scheduled day should be skipped based on edge case rules
   * Skips if scheduled time is less than 40 minutes away from current time
   */
  private shouldSkipScheduledDay(
    scheduledTime: Date,
    currentTime: Date,
    dayOfWeek: string,
    scheduledTimeString: string
  ): boolean {
    const timeDiff = scheduledTime.getTime() - currentTime.getTime();
    const minutesUntilScheduled = timeDiff / (1000 * 60); // Convert to minutes

    console.log(
      `📅 Checking ${dayOfWeek} ${scheduledTimeString}: ${minutesUntilScheduled.toFixed(
        1
      )} minutes until scheduled time`
    );

    // Edge case: If scheduled time is less than 40 minutes away, skip this day
    if (minutesUntilScheduled < 40) {
      console.log(
        `⏰ Skipping ${dayOfWeek} ${scheduledTimeString} - less than 40 minutes away (${minutesUntilScheduled.toFixed(
          1
        )} minutes)`
      );
      return true;
    }

    console.log(
      `✅ Scheduling ${dayOfWeek} ${scheduledTimeString} - ${minutesUntilScheduled.toFixed(
        1
      )} minutes away`
    );
    return false;
  }
}

export default VideoScheduleService;
