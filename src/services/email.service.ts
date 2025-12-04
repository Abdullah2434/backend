import nodemailer from "nodemailer";
import { EmailOptions } from "../types";

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isDevelopment: boolean;
  private brandName: string = "EdgeAi";
  private brandColor: string = "#5046E5";
  private brandSecondaryColor: string = "#282828";
  private brandAccentColor: string = "#667085";

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";

    // Get email configuration from environment variables
    const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
    const emailPort = parseInt(process.env.EMAIL_PORT || "587");
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailUser && emailPass) {
      try {
    
        this.transporter = nodemailer.createTransport({
          host: emailHost,
          port: emailPort,
          secure: false, // true for 465, false for other ports
          auth: {
            user: emailUser,
            pass: emailPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
      } catch (error) {
    
        this.transporter = null;
      }
    } else {
     
    }
  }

  /**
   * Generate email template wrapper with consistent styling
   */
  private generateEmailTemplate(
    content: string,
    showFooter: boolean = true
  ): string {
    const footer = showFooter
      ? `
      <div style="background-color: #f8fafc; padding: 24px; margin-top: 32px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          This is an automated email from ${
            this.brandName
          }. Please do not reply.
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          © ${new Date().getFullYear()} ${this.brandName}. All rights reserved.
        </p>
      </div>
    `
      : "";

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.brandName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background-color: #1f2937; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.025em; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              ${this.brandName}
            </h1>
            <p style="color: #d1d5db; margin: 8px 0 0 0; font-size: 14px; font-weight: 400; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              AI-Powered Video Creation Platform
            </p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 32px;">
            ${content}
          </div>
          
          ${footer}
        </div>
      </body>
      </html>
    `;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      if (this.isDevelopment) {

        return;
      }
      throw new Error("Email service not configured");
    }

    const mailOptions: EmailOptions = {
      to,
      subject,
      html: this.generateEmailTemplate(html),
    };

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || (process.env.EMAIL_USER as string),
      ...mailOptions,
    });
  }
}

const emailService = new EmailService();

export async function sendVerificationEmail(
  email: string,
  token: string,
  firstName?: string
) {
  const url = `${
    process.env.FRONTEND_URL || "https://www.edgeairealty.com"
  }/verify-email?token=${token}`;
  const name = firstName ? ` ${firstName}` : "";

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Welcome to EdgeAI${name}!
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Thank you for joining our AI-powered video creation platform. To get started, please verify your email address.
      </p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #5046E5;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Next Steps:
      </h3>
      <ol style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <li>Click the verification button below</li>
        <li>Complete your profile setup</li>
        <li>Start creating amazing AI videos</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
        Verify Email Address
      </a>
    </div>
    
    <div style="background-color: #fef3c7; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <p style="color: #92400e; margin: 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <strong>Security Note:</strong> This verification link will expire in 24 hours. If you didn't create an account with EdgeAI, please ignore this email.
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      If the button doesn't work, you can copy and paste this link into your browser:<br>
      <a href="${url}" style="color: #5046E5; word-break: break-all;">${url}</a>
    </p>
  `;

  await emailService.send(email, `Verify Your EdgeAI Account`, content);
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  firstName?: string
) {
  const url = `${
    process.env.FRONTEND_URL || "https://www.edgeairealty.com"
  }/reset-password?token=${token}`;
  const name = firstName ? ` ${firstName}` : "";

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Password Reset Request${name}
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        We received a request to reset your password for your EdgeAI account. If you made this request, click the button below to create a new password.
      </p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #5046E5;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        To reset your password:
      </h3>
      <ol style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <li>Click the "Reset Password" button below</li>
        <li>Enter your new password (minimum 8 characters)</li>
        <li>Confirm your new password</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
        Reset Password
      </a>
    </div>
    
    <div style="background-color: #fef2f2; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #ef4444;">
      <p style="color: #dc2626; margin: 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <strong>Security Alert:</strong> This password reset link will expire in 15 minutes for your security. If you didn't request this password reset, please ignore this email and your password will remain unchanged.
      </p>
    </div>
    
    <div style="background-color: #f0f9ff; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #0ea5e9;">
      <h4 style="color: #0c4a6e; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Password Security Tips:
      </h4>
      <ul style="color: #0369a1; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <li>Use a combination of letters, numbers, and symbols</li>
        <li>Make it at least 8 characters long</li>
        <li>Avoid using personal information</li>
        <li>Don't reuse passwords from other accounts</li>
      </ul>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      If the button doesn't work, you can copy and paste this link into your browser:<br>
      <a href="${url}" style="color: #5046E5; word-break: break-all;">${url}</a>
    </p>
  `;

  await emailService.send(email, `Reset Your EdgeAI Password`, content);
}

export async function sendWelcomeEmail(email: string, firstName: string) {
  const url = `${process.env.FRONTEND_URL || "https://www.edgeairealty.com"}`;

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Welcome to EdgeAI, ${firstName}! 🎉
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Your email has been successfully verified! You're now ready to start creating amazing AI-powered videos with our platform.
      </p>
    </div>
    
    <div style="background-color: #f0fdf4; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22c55e;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        🚀 What's Next?
      </h3>
      <ul style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <li>Complete your profile setup</li>
        <li>Choose a subscription plan that fits your needs</li>
        <li>Upload your first photo to create a custom avatar</li>
        <li>Start generating professional AI videos</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
        Go to Dashboard
      </a>
    </div>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #5046E5;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        💡 Getting Started Guide:
      </h3>
      <ol style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <li><strong>Upload a Photo or Video:</strong> Create your custom AI avatar by uploading a clear, well-lit photo or a video</li>
        <li><strong>Monthly Plan:</strong> Enjoy creating and downloading up to 30 videos each month</li>
        <li><strong>Create Your First Video:</strong> Use our intuitive interface to generate your first AI video</li>
        <li><strong>Download & Share:</strong> Export your videos in high quality and share them with the world</li>
      </ol>
    </div>
    
    <div style="background-color: #fef3c7; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <h4 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        📞 Need Help?
      </h4>
      <p style="color: #92400e; margin: 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Our support team is here to help you succeed. If you have any questions or need assistance, don't hesitate to reach out to us.
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      Ready to get started? <a href="${url}" style="color: #5046E5; text-decoration: none; font-weight: 600;">Access your dashboard</a> and begin your AI video creation journey!
    </p>
  `;

  await emailService.send(
    email,
    `Welcome to EdgeAI - Let's Create Amazing Videos!`,
    content
  );
}

export async function sendResendVerificationEmail(
  email: string,
  token: string,
  firstName?: string
) {
  const url = `${
    process.env.FRONTEND_URL || "https://www.edgeairealty.com"
  }/verify-email?token=${token}`;
  const name = firstName ? ` ${firstName}` : "";

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        New Verification Email${name}
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        We've generated a new verification link for your EdgeAI account. Please use this link to verify your email address and complete your registration.
      </p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #5046E5;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Quick Steps:
      </h3>
      <ol style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <li>Click the verification button below</li>
        <li>You'll be redirected to your dashboard</li>
        <li>Start creating amazing AI videos</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
        Verify Email Address
      </a>
    </div>
    
    <div style="background-color: #fef3c7; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <p style="color: #92400e; margin: 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <strong>Important:</strong> This new verification link will expire in 24 hours. If you continue to have issues, please contact our support team.
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      If the button doesn't work, you can copy and paste this link into your browser:<br>
      <a href="${url}" style="color: #5046E5; word-break: break-all;">${url}</a>
    </p>
  `;

  await emailService.send(email, `New EdgeAI Verification Link`, content);
}

// Additional professional email templates
export async function sendAvatarReadyNotification(
  email: string,
  firstName: string,
  avatarName: string
) {
  const url = `${process.env.FRONTEND_URL || "https://www.edgeairealty.com"}`;

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Your Avatar is Ready, ${firstName}! 🎭
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Great news! Your custom avatar "${avatarName}" has been successfully trained and is now ready to use in your AI videos.
      </p>
    </div>
    
    <div style="background-color: #f0fdf4; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22c55e;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        🎬 What You Can Do Now:
      </h3>
      <ul style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <li>Create professional AI videos with your custom avatar</li>
        <li>Choose from multiple voice options</li>
        <li>Generate videos in different languages</li>
        <li>Download high-quality video files</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
        Create Your First Video
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      Ready to bring your ideas to life? <a href="${url}" style="color: #5046E5; text-decoration: none; font-weight: 600;">Start creating videos</a> with your new avatar!
    </p>
  `;

  await emailService.send(email, `Your Custom Avatar is Ready!`, content);
}

export async function sendSubscriptionConfirmation(
  email: string,
  firstName: string,
  planName: string,
  amount: number
) {
  const url = `${process.env.FRONTEND_URL || "https://www.edgeairealty.com"}`;

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Subscription Confirmed, ${firstName}! ✅
      </h2>
      <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Thank you for upgrading to the ${planName}! Your subscription has been successfully activated and you now have access to premium features.
      </p>
    </div>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #5046E5;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        Subscription Details:
      </h3>
      <div style="color: #4b5563; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <p style="margin: 8px 0;"><strong>Plan:</strong> ${planName}</p>
        <p style="margin: 8px 0;"><strong>Amount:</strong> $${(
          amount / 100
        ).toFixed(2)}/month</p>
        <p style="margin: 8px 0;"><strong>Billing:</strong> Monthly</p>
        <p style="margin: 8px 0;"><strong>Status:</strong> Active</p>
      </div>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background-color: #5046E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
        Access Premium Features
      </a>
    </div>
    
    <div style="background-color: #f0f9ff; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid #0ea5e9;">
      <p style="color: #0369a1; margin: 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <strong>Need Help?</strong> If you have any questions about your subscription or need assistance, our support team is here to help.
      </p>
    </div>
  `;

  await emailService.send(
    email,
    `Welcome to ${planName} - Subscription Confirmed!`,
    content
  );
}

// Contact form email functions
export async function sendContactFormNotification(
  adminEmail: string,
  fullName: string,
  position: string,
  email: string,
  phone: string,
  question: string
) {
  const content = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Full Name:</strong> ${fullName}</p>
    <p><strong>Position/Title:</strong> ${position}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Question:</strong></p>
    <p>${question.replace(/\n/g, "<br>")}</p>
    <hr>
    <p><em>This message was sent from the contact form on your website.</em></p>
  `;

  await emailService.send(
    adminEmail,
    `Contact Form: ${fullName} - ${position}`,
    content
  );
}

export async function sendContactFormConfirmation(
  userEmail: string,
  fullName: string,
  question: string
) {
  const content = `
    <h2>Thank you for your message!</h2>
    <p>Hi ${fullName},</p>
    <p>We have received your question and will get back to you as soon as possible.</p>
    <p><strong>Your question:</strong></p>
    <p>${question.replace(/\n/g, "<br>")}</p>
    <hr>
    <p>Best regards,<br>Support Team</p>
  `;

  await emailService.send(userEmail, "Thank you for contacting us", content);
}
