import * as nodemailer from "nodemailer";
import { EmailOptions } from "../../../types";
import { EmailSendResult, EmailServiceConfig } from "../types/email.types";
import { EmailTemplateService } from "./email-template.service";

export class EmailSenderService {
  private config: EmailServiceConfig;
  private templateService: EmailTemplateService;

  constructor(
    config: EmailServiceConfig,
    templateService: EmailTemplateService
  ) {
    this.config = config;
    this.templateService = templateService;
  }

  public async send(
    to: string,
    subject: string,
    html: string
  ): Promise<EmailSendResult> {
    try {
      if (!this.config.transporter) {
        if (this.config.isDevelopment) {
          console.log("[DEV EMAIL] To:", to);
          console.log("[DEV EMAIL] Subject:", subject);
          console.log("[DEV EMAIL] HTML:", html);
          return {
            success: true,
            messageId: "dev-mode-message-id",
          };
        }
        throw new Error("Email service not configured");
      }

      const mailOptions: EmailOptions = {
        to,
        subject,
        html: this.templateService.generateEmailTemplate(html),
      };

      const result = await this.config.transporter.sendMail({
        from:
          this.config.transporter.options.auth?.user || process.env.EMAIL_FROM,
        ...mailOptions,
      });

      console.log(`✅ Email sent successfully to ${to}:`, result.messageId);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error: any) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public async sendBulk(
    emails: Array<{ to: string; subject: string; html: string }>
  ): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    for (const email of emails) {
      const result = await this.send(email.to, email.subject, email.html);
      results.push(result);

      // Add a small delay between emails to avoid rate limiting
      if (emails.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  public async sendWithTemplate(
    to: string,
    subject: string,
    templateContent: string,
    templateData?: Record<string, any>
  ): Promise<EmailSendResult> {
    try {
      // Replace template variables if provided
      let processedContent = templateContent;
      if (templateData) {
        for (const [key, value] of Object.entries(templateData)) {
          const placeholder = new RegExp(`{{${key}}}`, "g");
          processedContent = processedContent.replace(
            placeholder,
            String(value)
          );
        }
      }

      return await this.send(to, subject, processedContent);
    } catch (error: any) {
      console.error(`❌ Failed to send templated email to ${to}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  public async verifyConnection(): Promise<boolean> {
    if (!this.config.transporter) {
      console.log("Email transporter not configured");
      return false;
    }

    try {
      await this.config.transporter.verify();
      console.log("✅ Email service connection verified");
      return true;
    } catch (error) {
      console.error("❌ Email service connection verification failed:", error);
      return false;
    }
  }

  public isConfigured(): boolean {
    return !!this.config.transporter;
  }

  public getConfigurationStatus(): {
    configured: boolean;
    development: boolean;
    transporter: boolean;
  } {
    return {
      configured: this.isConfigured(),
      development: this.config.isDevelopment,
      transporter: !!this.config.transporter,
    };
  }
}
