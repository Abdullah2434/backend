import { EmailConfigService } from "./email-config.service";
import { EmailTemplateService } from "./email-template.service";
import { EmailSenderService } from "./email-sender.service";
import { EmailAuthService } from "./email-auth.service";
import { EmailContactService } from "./email-contact.service";
import {
  VerificationEmailData,
  PasswordResetEmailData,
  WelcomeEmailData,
  SubscriptionWelcomeEmailData,
  ContactFormNotificationData,
  ContactFormConfirmationData,
  EmailSendResult,
} from "../types/email.types";

export class EmailService {
  private configService: EmailConfigService;
  private templateService: EmailTemplateService;
  private senderService: EmailSenderService;
  private authService: EmailAuthService;
  private contactService: EmailContactService;

  constructor() {
    this.configService = new EmailConfigService();
    const config = this.configService.getServiceConfig();
    const brandConfig = this.configService.getBrandConfig();

    this.templateService = new EmailTemplateService(brandConfig);
    this.senderService = new EmailSenderService(config, this.templateService);
    this.authService = new EmailAuthService(
      this.senderService,
      this.templateService,
      this.configService.getFrontendUrl()
    );
    this.contactService = new EmailContactService(
      this.senderService,
      this.templateService
    );
  }

  // ==================== AUTH EMAIL METHODS ====================

  public async sendVerificationEmail(
    email: string,
    token: string,
    firstName?: string
  ): Promise<EmailSendResult> {
    try {
      const data: VerificationEmailData = {
        to: email,
        token,
        firstName,
      };
      await this.authService.sendVerificationEmail(data);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to send verification email:", error);
      return { success: false, error: error.message };
    }
  }

  public async sendResendVerificationEmail(
    email: string,
    token: string,
    firstName?: string
  ): Promise<EmailSendResult> {
    // This is the same as sendVerificationEmail, just with a different name for clarity
    return await this.sendVerificationEmail(email, token, firstName);
  }

  public async sendPasswordResetEmail(
    email: string,
    token: string,
    firstName?: string
  ): Promise<EmailSendResult> {
    try {
      const data: PasswordResetEmailData = {
        to: email,
        token,
        firstName,
      };
      await this.authService.sendPasswordResetEmail(data);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to send password reset email:", error);
      return { success: false, error: error.message };
    }
  }

  public async sendWelcomeEmail(
    email: string,
    firstName: string
  ): Promise<EmailSendResult> {
    try {
      const data: WelcomeEmailData = {
        to: email,
        firstName,
      };
      await this.authService.sendWelcomeEmail(data);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to send welcome email:", error);
      return { success: false, error: error.message };
    }
  }

  public async sendSubscriptionWelcomeEmail(
    email: string,
    firstName: string,
    planName: string,
    planPrice: string,
    billingCycle: string
  ): Promise<EmailSendResult> {
    try {
      const data: SubscriptionWelcomeEmailData = {
        to: email,
        firstName,
        planName,
        planPrice,
        billingCycle,
      };
      await this.authService.sendSubscriptionWelcomeEmail(data);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to send subscription welcome email:", error);
      return { success: false, error: error.message };
    }
  }

  // ==================== CONTACT EMAIL METHODS ====================

  public async sendContactFormNotification(
    adminEmail: string,
    fullName: string,
    position: string,
    email: string,
    phone: string,
    question: string
  ): Promise<EmailSendResult> {
    try {
      const data: ContactFormNotificationData = {
        adminEmail,
        fullName,
        position,
        email,
        phone,
        question,
      };
      await this.contactService.sendContactFormNotification(data);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to send contact form notification:", error);
      return { success: false, error: error.message };
    }
  }

  public async sendContactFormConfirmation(
    userEmail: string,
    fullName: string,
    question: string
  ): Promise<EmailSendResult> {
    try {
      const data: ContactFormConfirmationData = {
        to: userEmail,
        fullName,
        question,
      };
      await this.contactService.sendContactFormConfirmation(data);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to send contact form confirmation:", error);
      return { success: false, error: error.message };
    }
  }

  // ==================== CORE EMAIL METHODS ====================

  public async send(
    to: string,
    subject: string,
    html: string
  ): Promise<EmailSendResult> {
    return await this.senderService.send(to, subject, html);
  }

  public async sendBulk(
    emails: Array<{ to: string; subject: string; html: string }>
  ): Promise<EmailSendResult[]> {
    return await this.senderService.sendBulk(emails);
  }

  public async sendWithTemplate(
    to: string,
    subject: string,
    templateContent: string,
    templateData?: Record<string, any>
  ): Promise<EmailSendResult> {
    return await this.senderService.sendWithTemplate(
      to,
      subject,
      templateContent,
      templateData
    );
  }

  // ==================== UTILITY METHODS ====================

  public async verifyConnection(): Promise<boolean> {
    return await this.senderService.verifyConnection();
  }

  public isConfigured(): boolean {
    return this.senderService.isConfigured();
  }

  public getConfigurationStatus() {
    return this.senderService.getConfigurationStatus();
  }

  public getFrontendUrl(): string {
    return this.configService.getFrontendUrl();
  }

  public getAdminEmail(): string {
    return this.configService.getAdminEmail();
  }

  // ==================== HEALTH CHECK ====================

  public async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    configured: boolean;
    connection: boolean;
    services: {
      config: boolean;
      template: boolean;
      sender: boolean;
      auth: boolean;
      contact: boolean;
    };
  }> {
    try {
      const configured = this.isConfigured();
      const connection = configured ? await this.verifyConnection() : false;

      const services = {
        config: !!this.configService,
        template: !!this.templateService,
        sender: !!this.senderService,
        auth: !!this.authService,
        contact: !!this.contactService,
      };

      const allServicesHealthy = Object.values(services).every(Boolean);
      const status =
        configured && connection && allServicesHealthy
          ? "healthy"
          : "unhealthy";

      return {
        status,
        configured,
        connection,
        services,
      };
    } catch (error) {
      console.error("Email service health check failed:", error);
      return {
        status: "unhealthy",
        configured: false,
        connection: false,
        services: {
          config: false,
          template: false,
          sender: false,
          auth: false,
          contact: false,
        },
      };
    }
  }
}

export default EmailService;
