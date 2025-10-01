import * as nodemailer from "nodemailer";
import {
  EmailConfig,
  EmailBrandConfig,
  EmailServiceConfig,
} from "../types/email.types";

export class EmailConfigService {
  private config: EmailConfig;
  private brandConfig: EmailBrandConfig;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.config = this.loadEmailConfig();
    this.brandConfig = this.loadBrandConfig();
  }

  private loadEmailConfig(): EmailConfig {
    const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com";
    const emailPort = parseInt(process.env.EMAIL_PORT || "587");
    const emailUser = process.env.EMAIL_USER || "";
    const emailPass = process.env.EMAIL_PASS || "";
    const emailFrom = process.env.EMAIL_FROM || emailUser;

    return {
      host: emailHost,
      port: emailPort,
      user: emailUser,
      pass: emailPass,
      from: emailFrom,
      secure: false, // true for 465, false for other ports
      tls: {
        rejectUnauthorized: false,
      },
    };
  }

  private loadBrandConfig(): EmailBrandConfig {
    return {
      brandName: "EdgeAI",
      brandColor: "#5046E5",
      brandSecondaryColor: "#282828",
      brandAccentColor: "#667085",
    };
  }

  public createTransporter(): nodemailer.Transporter | null {
    if (!this.config.user || !this.config.pass) {
      console.log("Email service not configured - running in development mode");
      console.log("Required environment variables: EMAIL_USER, EMAIL_PASS");
      console.log(
        "Current values: EMAIL_USER=" + (this.config.user ? "SET" : "NOT SET"),
        "EMAIL_PASS=" + (this.config.pass ? "SET" : "NOT SET")
      );
      return null;
    }

    try {
      console.log(
        `[Email Service] Configuring SMTP with host: ${this.config.host}, port: ${this.config.port}, user: ${this.config.user}`
      );

      const transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass,
        },
        tls: this.config.tls,
      });

      console.log("✅ Email service configured successfully with SMTP");
      return transporter;
    } catch (error) {
      console.error("Email service configuration failed:", error);
      return null;
    }
  }

  public getServiceConfig(): EmailServiceConfig {
    return {
      isDevelopment: this.isDevelopment,
      transporter: this.createTransporter(),
      brandConfig: this.brandConfig,
    };
  }

  public getBrandConfig(): EmailBrandConfig {
    return this.brandConfig;
  }

  public getEmailConfig(): EmailConfig {
    return this.config;
  }

  public isConfigured(): boolean {
    return !!(this.config.user && this.config.pass);
  }

  public getFrontendUrl(): string {
    return process.env.FRONTEND_URL || "https://www.edgeairealty.com";
  }

  public getAdminEmail(): string {
    return process.env.ADMIN_EMAIL || "admin@edgeairealty.com";
  }
}
