/**
 * Helper functions for VideoSchedule email templates
 */

import TimezoneService from "../utils/timezone";
import {
  FREQUENCY_ONCE_WEEK,
  FREQUENCY_TWICE_WEEK,
  FREQUENCY_THREE_WEEK,
  FREQUENCY_DAILY,
  SUPPORT_EMAIL,
  EDGEAI_WEBSITE_URL,
  CREATE_VIDEO_URL,
  FRONTEND_URL,
} from "../constants/videoScheduleService.constants";
import {
  ScheduleEmailData,
  VideoProcessingEmailData,
  VideoGeneratedEmailData,
} from "../types/videoScheduleService.types";

// ==================== FREQUENCY HELPERS ====================
/**
 * Get frequency text for display
 */
export function getFrequencyText(frequency: string): string {
  switch (frequency) {
    case FREQUENCY_ONCE_WEEK:
      return "Once a week";
    case FREQUENCY_TWICE_WEEK:
      return "Twice a week";
    case FREQUENCY_THREE_WEEK:
      return "Three times a week";
    case FREQUENCY_DAILY:
      return "Daily";
    default:
      return frequency;
  }
}

/**
 * Get schedule text for display
 */
export function getScheduleText(schedule: {
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

// ==================== DATE/TIME HELPERS ====================
/**
 * Convert date to local timezone and split into date and time parts
 */
export function convertDateToLocalParts(
  date: Date,
  timezone: string
): { datePart: string; timePart: string } {
  const localDateTime = TimezoneService.convertFromUTC(date, timezone);
  const [datePart, timePart] = localDateTime.split(" ");
  return { datePart, timePart };
}

// ==================== EMAIL TEMPLATE HELPERS ====================
/**
 * Generate schedule created email template
 */
export function generateScheduleCreatedTemplate(
  data: ScheduleEmailData
): string {
  const frequencyText = getFrequencyText(data.frequency);
  const scheduleText = getScheduleText(data.schedule);

  const { datePart: startDatePart } = convertDateToLocalParts(
    data.startDate,
    data.timezone
  );
  const { datePart: endDatePart } = convertDateToLocalParts(
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
            <div><strong>Start Date:</strong> ${startDatePart}</div>
            <div><strong>End Date:</strong> ${endDatePart}</div>
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
                const { datePart, timePart } = convertDateToLocalParts(
                  video.scheduledFor,
                  data.timezone
                );
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

        <!-- Visit Website Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${EDGEAI_WEBSITE_URL}" 
             target="_blank"
             style="background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
            🌐 Visit EdgeAI Website
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
          <p style="color: #667085; margin: 0; font-size: 14px;">
            Need help? Contact us at ${SUPPORT_EMAIL}
          </p>
          <p style="color: #667085; margin: 10px 0 0 0; font-size: 14px;">
            <a href="${EDGEAI_WEBSITE_URL}" target="_blank" style="color: #5046E5; text-decoration: none;">Visit our website</a>
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
export function generateVideoProcessingTemplate(
  data: VideoProcessingEmailData
): string {
  const { datePart, timePart } = convertDateToLocalParts(
    data.startedAt,
    data.timezone
  );

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
            Need help? Contact us at ${SUPPORT_EMAIL}
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
export function generateVideoGeneratedTemplate(
  data: VideoGeneratedEmailData
): string {
  const isLastVideo = data.isLastVideo;
  const { datePart, timePart } = convertDateToLocalParts(
    data.generatedAt,
    data.timezone
  );

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

        <!-- Review Video Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${CREATE_VIDEO_URL}" 
             style="background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
            🎬 Review Video
          </a>
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
            <a href="${FRONTEND_URL}/schedule" 
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
            Need help? Contact us at ${SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

