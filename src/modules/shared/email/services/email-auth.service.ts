import { EmailSenderService } from "./email-sender.service";
import { EmailTemplateService } from "./email-template.service";
import {
  VerificationEmailData,
  PasswordResetEmailData,
  WelcomeEmailData,
  SubscriptionWelcomeEmailData,
} from "../types/email.types";

export class EmailAuthService {
  private sender: EmailSenderService;
  private template: EmailTemplateService;
  private frontendUrl: string;

  constructor(
    sender: EmailSenderService,
    template: EmailTemplateService,
    frontendUrl: string
  ) {
    this.sender = sender;
    this.template = template;
    this.frontendUrl = frontendUrl;
  }

  public async sendVerificationEmail(
    data: VerificationEmailData
  ): Promise<void> {
    const { to, token, firstName } = data;
    const url = `${this.frontendUrl}/verify-email?token=${token}`;
    const name = firstName ? ` ${firstName}` : "";

    const content = `
      ${this.template.createSection(
        `Welcome to EdgeAI${name}!`,
        `Thank you for joining our AI-powered video creation platform. To get started, please verify your email address.`
      )}
      
      ${this.template.createInfoBox(
        "To verify your email:",
        this.template.createList([
          'Click the "Verify Email" button below',
          "You'll be redirected to your dashboard",
          "Start creating amazing AI videos!",
        ])
      )}
      
      ${this.template.createButton("Verify Email", url)}
      
      ${this.template.createAlertBox(
        "Security Alert: This verification link will expire in 24 hours for your security. If you didn't create an account, please ignore this email.",
        "warning"
      )}
      
      ${this.template.createInfoBox(
        "What's Next?",
        this.template.createList([
          "Explore our AI video templates",
          "Upload your content and customize",
          "Generate professional videos in minutes",
          "Share your creations with the world",
        ])
      )}
      
      ${this.template.createParagraph(
        `If the button doesn't work, you can copy and paste this link into your browser:<br>
        ${this.template.createLink(url, url)}`
      )}
    `;

    await this.sender.send(to, "Verify Your EdgeAI Account", content);
  }

  public async sendPasswordResetEmail(
    data: PasswordResetEmailData
  ): Promise<void> {
    const { to, token, firstName } = data;
    const url = `${this.frontendUrl}/reset-password?token=${token}`;
    const name = firstName ? ` ${firstName}` : "";

    const content = `
      ${this.template.createSection(
        `Password Reset Request${name ? ` for ${name}` : ""}`,
        `We received a request to reset your password for your EdgeAI account. If you made this request, click the button below to create a new password.`
      )}
      
      ${this.template.createInfoBox(
        "To reset your password:",
        this.template.createList([
          'Click the "Reset Password" button below',
          "Enter your new password (minimum 8 characters)",
          "Confirm your new password",
        ])
      )}
      
      ${this.template.createButton("Reset Password", url)}
      
      ${this.template.createAlertBox(
        "Security Alert: This password reset link will expire in 15 minutes for your security. If you didn't request this password reset, please ignore this email and your password will remain unchanged.",
        "error"
      )}
      
      ${this.template.createInfoBox(
        "Password Security Tips:",
        this.template.createList([
          "Use a combination of letters, numbers, and symbols",
          "Make it at least 8 characters long",
          "Avoid using personal information",
          "Don't reuse passwords from other accounts",
        ])
      )}
      
      ${this.template.createParagraph(
        `If the button doesn't work, you can copy and paste this link into your browser:<br>
        ${this.template.createLink(url, url)}`
      )}
    `;

    await this.sender.send(to, "Reset Your EdgeAI Password", content);
  }

  public async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    const { to, firstName } = data;

    const content = `
      ${this.template.createSection(
        `Welcome to EdgeAI, ${firstName}!`,
        `Your email has been successfully verified! You're now ready to start creating amazing AI-powered videos.`
      )}
      
      ${this.template.createInfoBox(
        "Getting Started:",
        this.template.createList([
          "Explore our video templates library",
          "Upload your content (images, videos, text)",
          "Customize with AI-powered tools",
          "Generate and download your videos",
          "Share your creations on social media",
        ])
      )}
      
      ${this.template.createButton(
        "Start Creating Videos",
        `${this.frontendUrl}/dashboard`
      )}
      
      ${this.template.createInfoBox(
        "Need Help?",
        this.template.createList([
          "Check out our tutorial videos",
          "Read our comprehensive guide",
          "Contact our support team",
          "Join our community forum",
        ])
      )}
      
      ${this.template.createParagraph(
        "We're excited to see what you'll create with EdgeAI!"
      )}
    `;

    await this.sender.send(to, "Welcome to EdgeAI - Let's Create!", content);
  }

  public async sendSubscriptionWelcomeEmail(
    data: SubscriptionWelcomeEmailData
  ): Promise<void> {
    const { to, firstName, planName, planPrice, billingCycle } = data;

    const content = `
      ${this.template.createSection(
        `Welcome to ${planName}, ${firstName}!`,
        `Your subscription has been successfully activated! You now have access to premium features and unlimited video creation.`
      )}
      
      ${this.template.createInfoBox(
        "Your Subscription Details:",
        this.template.createList([
          `Plan: ${planName}`,
          `Price: ${planPrice}`,
          `Billing: ${billingCycle}`,
          `Status: Active`,
        ])
      )}
      
      ${this.template.createInfoBox(
        "Premium Features Now Available:",
        this.template.createList([
          "Unlimited video generation",
          "High-resolution exports",
          "Advanced AI templates",
          "Priority customer support",
          "Commercial usage rights",
          "Custom branding options",
        ])
      )}
      
      ${this.template.createButton(
        "Access Premium Features",
        `${this.frontendUrl}/dashboard`
      )}
      
      ${this.template.createInfoBox(
        "Manage Your Subscription:",
        this.template.createList([
          "Update payment methods",
          "Change billing cycle",
          "View usage statistics",
          "Download invoices",
        ])
      )}
      
      ${this.template.createParagraph(
        "Thank you for choosing EdgeAI! We're here to help you create amazing content."
      )}
    `;

    await this.sender.send(
      to,
      `Welcome to ${planName} - Subscription Confirmed!`,
      content
    );
  }
}
