/**
 * Email templates for scheduled video processing failures
 */

export interface VideoLimitReachedEmailData {
  videoTitle: string;
  limit: number;
  remaining: number;
  used: number;
  frontendUrl: string;
}

export interface SubscriptionExpiredEmailData {
  videoTitle: string;
  frontendUrl: string;
}

/**
 * Generate email content for video limit reached
 */
export function generateVideoLimitReachedEmail(
  data: VideoLimitReachedEmailData
): string {
  return `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        ⚠️ Video Limit Reached
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Your scheduled video could not be created because you have reached your monthly video limit.
      </p>
    </div>
    
    <div style="background-color: #fef2f2; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #ef4444;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Failed Video
      </h3>
      <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <strong>${data.videoTitle}</strong>
      </p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #5046E5;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        📊 Your Video Usage
      </h3>
      <ul style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <li><strong>Videos used this month:</strong> ${data.used} out of ${data.limit}</li>
        <li><strong>Remaining videos:</strong> ${data.remaining}</li>
      </ul>
    </div>
    
    <div style="background-color: #f0fdf4; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22c55e;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        🔄 What Happens Next?
      </h3>
      <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Your subscription will renew monthly, allowing you to create more videos next month. Your scheduled videos will resume automatically once your quota resets.
      </p>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.frontendUrl}" style="display: inline-block; background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
        Visit Dashboard
      </a>
    </div>
    
    <div style="background-color: #fef3c7; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <p style="color: #92400e; margin: 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <strong>Note:</strong> This scheduled video has been marked as failed. You can check your schedule status in the dashboard.
      </p>
    </div>
  `;
}

/**
 * Generate email content for subscription expired
 */
export function generateSubscriptionExpiredEmail(
  data: SubscriptionExpiredEmailData
): string {
  return `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        ⚠️ Subscription Required
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Your scheduled video could not be created because your subscription has expired or is not active.
      </p>
    </div>
    
    <div style="background-color: #fef2f2; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #ef4444;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Failed Video
      </h3>
      <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <strong>${data.videoTitle}</strong>
      </p>
    </div>
    
    <div style="background-color: #f0fdf4; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22c55e;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        🔄 What You Need to Do
      </h3>
      <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        To continue creating videos, please renew or activate your subscription. Once your subscription is active, your scheduled videos will resume automatically.
      </p>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.frontendUrl}" style="display: inline-block; background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
        Visit Dashboard
      </a>
    </div>
    
    <div style="background-color: #fef3c7; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <p style="color: #92400e; margin: 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <strong>Note:</strong> This scheduled video has been marked as failed. You can check your schedule status and subscription details in the dashboard.
      </p>
    </div>
  `;
}

