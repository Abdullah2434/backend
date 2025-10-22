import { EmailService } from "./email";
import TimezoneService from "../utils/timezone";

export interface ScheduleEmailData {
  userEmail: string;
  userName?: string;
  scheduleId: string;
  frequency: string;
  startDate: Date;
  endDate: Date;
  totalVideos: number;
  timezone: string; // Add timezone for proper date/time conversion
  schedule: {
    days: string[];
    times: string[];
  };
  videos: Array<{
    description: string;
    keypoints: string;
    scheduledFor: Date;
    status: string;
  }>;
}

export interface VideoGeneratedEmailData {
  userEmail: string;
  userName?: string;
  videoTitle: string;
  videoDescription: string;
  videoKeypoints: string;
  generatedAt: Date;
  videoId?: string;
  isLastVideo: boolean;
  scheduleId: string;
  timezone: string; // Add timezone for proper date/time conversion
}

export interface VideoProcessingEmailData {
  userEmail: string;
  userName?: string;
  videoTitle: string;
  videoDescription: string;
  videoKeypoints: string;
  startedAt: Date;
  scheduleId: string;
  timezone: string; // Add timezone for proper date/time conversion
}

class ScheduleEmailService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Send email when schedule is created
   */
  async sendScheduleCreatedEmail(data: ScheduleEmailData): Promise<void> {
    const subject = `🎬 Your Video Schedule is Ready! ${data.totalVideos} videos scheduled`;

    const html = this.generateScheduleCreatedTemplate(data);

    await this.emailService.send(data.userEmail, subject, html);

    console.log(`📧 Schedule created email sent to ${data.userEmail}`);
  }

  /**
   * Send email when a video starts processing
   */
  async sendVideoProcessingEmail(
    data: VideoProcessingEmailData
  ): Promise<void> {
    const subject = `🎬 Video Processing Started: ${data.videoTitle}`;

    const html = this.generateVideoProcessingTemplate(data);

    await this.emailService.send(data.userEmail, subject, html);

    console.log(`📧 Video processing email sent to ${data.userEmail}`);
  }

  /**
   * Send email when a video is generated
   */
  async sendVideoGeneratedEmail(data: VideoGeneratedEmailData): Promise<void> {
    const subject = data.isLastVideo
      ? `🎉 Final Video Generated! Your schedule is complete`
      : `✅ Video Generated: ${data.videoTitle}`;

    const html = this.generateVideoGeneratedTemplate(data);

    await this.emailService.send(data.userEmail, subject, html);

    console.log(`📧 Video generated email sent to ${data.userEmail}`);
  }

  /**
   * Generate schedule created email template
   */
  private generateScheduleCreatedTemplate(data: ScheduleEmailData): string {
    const frequencyText = this.getFrequencyText(data.frequency);
    const scheduleText = this.getScheduleText(data.schedule);

    // Convert dates to user's timezone for display
    const startDateLocal = TimezoneService.convertFromUTC(
      data.startDate,
      data.timezone
    );
    const endDateLocal = TimezoneService.convertFromUTC(
      data.endDate,
      data.timezone
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Schedule Created</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #5046E5; margin: 0; font-size: 28px;">🎬 Video Schedule Created!</h1>
            <p style="color: #667085; margin: 10px 0 0 0; font-size: 16px;">Your automated video content is ready to go</p>
          </div>

          <!-- Schedule Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #282828; margin: 0 0 15px 0; font-size: 20px;">📅 Schedule Details</h2>
            <div style="display: grid; gap: 10px;">
              <div><strong>Frequency:</strong> ${frequencyText}</div>
              <div><strong>Schedule:</strong> ${scheduleText}</div>
              <div><strong>Start Date:</strong> ${
                startDateLocal.split(" ")[0]
              }</div>
              <div><strong>End Date:</strong> ${
                endDateLocal.split(" ")[0]
              }</div>
              <div><strong>Total Videos:</strong> ${data.totalVideos}</div>
              <div><strong>Timezone:</strong> ${data.timezone}</div>
            </div>
          </div>

          <!-- Upcoming Videos -->
          <div style="margin-bottom: 20px;">
            <h2 style="color: #282828; margin: 0 0 15px 0; font-size: 20px;">🎥 Upcoming Videos</h2>
            <div style="display: grid; gap: 10px;">
              ${data.videos
                .slice(0, 5)
                .map((video, index) => {
                  // Convert scheduled time to user's timezone
                  const scheduledLocal = TimezoneService.convertFromUTC(
                    video.scheduledFor,
                    data.timezone
                  );
                  const [datePart, timePart] = scheduledLocal.split(" ");
                  return `
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #5046E5;">
                  <div style="font-weight: bold; color: #282828; margin-bottom: 5px;">
                    Video ${index + 1}: ${video.description}
                  </div>
                  <div style="color: #667085; font-size: 14px; margin-bottom: 5px;">
                    ${video.keypoints}
                  </div>
                  <div style="color: #5046E5; font-size: 14px; font-weight: bold;">
                    📅 ${datePart} at ${timePart} (${data.timezone})
                  </div>
                </div>
              `;
                })
                .join("")}
              ${
                data.videos.length > 5
                  ? `<div style="text-align: center; color: #667085; font-style: italic;">... and ${
                      data.videos.length - 5
                    } more videos</div>`
                  : ""
              }
            </div>
          </div>

          <!-- What Happens Next -->
          <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #282828; margin: 0 0 10px 0;">🚀 What Happens Next?</h3>
            <ul style="color: #667085; margin: 0; padding-left: 20px;">
              <li>Videos will be generated automatically 30 minutes before each scheduled time</li>
              <li>You'll receive an email notification when each video is ready</li>
              <li>All videos will use your saved profile settings (avatar, voice, company info)</li>
              <li>Content is generated using AI-powered real estate trends</li>
            </ul>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
            <p style="color: #667085; margin: 0; font-size: 14px;">
              Need help? Contact us at support@edgeai.com
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate video processing email template
   */
  private generateVideoProcessingTemplate(
    data: VideoProcessingEmailData
  ): string {
    // Convert started time to user's timezone for display
    const startedLocal = TimezoneService.convertFromUTC(
      data.startedAt,
      data.timezone
    );
    const [datePart, timePart] = startedLocal.split(" ");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Processing Started</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #5046E5; margin: 0; font-size: 28px;">🎬 Video Processing Started!</h1>
            <p style="color: #667085; margin: 10px 0 0 0; font-size: 16px;">Your scheduled video is being created</p>
          </div>

          <!-- Video Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #282828; margin: 0 0 15px 0; font-size: 20px;">🎥 Video Details</h2>
            <div style="display: grid; gap: 10px;">
              <div><strong>Title:</strong> ${data.videoTitle}</div>
              <div><strong>Description:</strong> ${data.videoDescription}</div>
              <div><strong>Key Points:</strong> ${data.videoKeypoints}</div>
              <div><strong>Processing Started:</strong> ${datePart} at ${timePart} (${data.timezone})</div>
            </div>
          </div>

          <!-- Processing Info -->
          <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #282828; margin: 0 0 10px 0;">⏳ What's Happening Now?</h3>
            <ul style="color: #667085; margin: 0; padding-left: 20px;">
              <li>Your video is being generated using AI technology</li>
              <li>This process typically takes 10-15 minutes</li>
              <li>You'll receive another email when the video is ready</li>
              <li>All your profile settings (avatar, voice, company info) are being applied</li>
            </ul>
          </div>

          <!-- Next Steps -->
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">📧 What's Next?</h3>
            <p style="color: #856404; margin: 0;">
              You'll receive an email notification when your video is ready. No action needed from you right now!
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
            <p style="color: #667085; margin: 0; font-size: 14px;">
              Need help? Contact us at support@edgeai.com
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate video generated email template
   */
  private generateVideoGeneratedTemplate(
    data: VideoGeneratedEmailData
  ): string {
    const isLastVideo = data.isLastVideo;

    // Convert generated time to user's timezone for display
    const generatedLocal = TimezoneService.convertFromUTC(
      data.generatedAt,
      data.timezone
    );
    const [datePart, timePart] = generatedLocal.split(" ");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Generated</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #5046E5; margin: 0; font-size: 28px;">
              ${isLastVideo ? "🎉 Final Video Ready!" : "✅ Video Generated!"}
            </h1>
            <p style="color: #667085; margin: 10px 0 0 0; font-size: 16px;">
              ${
                isLastVideo
                  ? "Your schedule is complete"
                  : "Your latest video is ready"
              }
            </p>
          </div>

          <!-- Video Details -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #282828; margin: 0 0 15px 0; font-size: 20px;">🎥 Video Details</h2>
            <div style="display: grid; gap: 10px;">
              <div><strong>Title:</strong> ${data.videoTitle}</div>
              <div><strong>Description:</strong> ${data.videoDescription}</div>
              <div><strong>Key Points:</strong> ${data.videoKeypoints}</div>
              <div><strong>Generated:</strong> ${datePart} at ${timePart} (${
      data.timezone
    })</div>
              ${
                data.videoId
                  ? `<div><strong>Video ID:</strong> ${data.videoId}</div>`
                  : ""
              }
            </div>
          </div>

          ${
            isLastVideo
              ? `
          <!-- Last Video - Reschedule CTA -->
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">🔄 Your Schedule is Complete!</h3>
            <p style="color: #856404; margin: 0 0 15px 0;">
              All videos in your current schedule have been generated. Create a new schedule to continue your automated video content.
            </p>
            <div style="text-align: center;">
              <a href="${
                process.env.FRONTEND_URL || "https://yourapp.com"
              }/schedule" 
                 style="background-color: #5046E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Create New Schedule
              </a>
            </div>
          </div>
          `
              : `
          <!-- Regular Video - Next Steps -->
          <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #282828; margin: 0 0 10px 0;">📅 What's Next?</h3>
            <p style="color: #667085; margin: 0;">
              Your video has been generated and is ready for use. The next video in your schedule will be created automatically.
            </p>
          </div>
          `
          }

          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
            <p style="color: #667085; margin: 0; font-size: 14px;">
              Need help? Contact us at support@edgeai.com
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get frequency text for display
   */
  private getFrequencyText(frequency: string): string {
    switch (frequency) {
      case "once_week":
        return "Once a week";
      case "twice_week":
        return "Twice a week";
      case "three_week":
        return "Three times a week";
      case "daily":
        return "Daily";
      default:
        return frequency;
    }
  }

  /**
   * Get schedule text for display
   */
  private getScheduleText(schedule: {
    days: string[];
    times: string[];
  }): string {
    if (schedule.days.length === 0) {
      return `Daily at ${schedule.times[0]}`;
    }

    const dayTimePairs = schedule.days.map((day, index) => {
      const time = schedule.times[index] || schedule.times[0];
      return `${day} at ${time}`;
    });

    return dayTimePairs.join(", ");
  }
}

export default ScheduleEmailService;
