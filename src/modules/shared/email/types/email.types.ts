import { EmailOptions } from "../../../../types";

// ==================== EMAIL CONFIGURATION TYPES ====================

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
  tls: {
    rejectUnauthorized: boolean;
  };
}

export interface EmailBrandConfig {
  brandName: string;
  brandColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
}

// ==================== EMAIL TEMPLATE TYPES ====================

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface BaseEmailData {
  to: string;
  from?: string;
}

export interface EmailTemplateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  url?: string;
  token?: string;
  [key: string]: any;
}

// ==================== AUTH EMAIL TYPES ====================

export interface VerificationEmailData extends BaseEmailData {
  token: string;
  firstName?: string;
}

export interface PasswordResetEmailData extends BaseEmailData {
  token: string;
  firstName?: string;
}

export interface WelcomeEmailData extends BaseEmailData {
  firstName: string;
}

export interface SubscriptionWelcomeEmailData extends BaseEmailData {
  firstName: string;
  planName: string;
  planPrice: string;
  billingCycle: string;
}

// ==================== CONTACT EMAIL TYPES ====================

export interface ContactFormNotificationData {
  adminEmail: string;
  fullName: string;
  position: string;
  email: string;
  phone: string;
  question: string;
}

export interface ContactFormConfirmationData extends BaseEmailData {
  fullName: string;
  question: string;
}

// ==================== EMAIL SERVICE TYPES ====================

export interface EmailServiceConfig {
  isDevelopment: boolean;
  transporter: any | null;
  brandConfig: EmailBrandConfig;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ==================== EMAIL TEMPLATE COMPONENTS ====================

export interface EmailHeader {
  title: string;
  subtitle?: string;
}

export interface EmailButton {
  text: string;
  url: string;
  color?: string;
}

export interface EmailFooter {
  companyName: string;
  companyAddress?: string;
  unsubscribeUrl?: string;
}

// ==================== EMAIL VALIDATION TYPES ====================

export interface EmailValidationResult {
  isValid: boolean;
  errors: string[];
}

// ==================== EMAIL LOGGING TYPES ====================

export interface EmailLogEntry {
  timestamp: Date;
  to: string;
  subject: string;
  type:
    | "verification"
    | "password_reset"
    | "welcome"
    | "contact"
    | "subscription"
    | "custom";
  success: boolean;
  error?: string;
  messageId?: string;
}

// ==================== EMAIL RATE LIMITING TYPES ====================

export interface EmailRateLimit {
  maxEmailsPerHour: number;
  maxEmailsPerDay: number;
  cooldownPeriod: number; // in minutes
}

export interface EmailRateLimitStatus {
  canSend: boolean;
  remainingEmails: number;
  resetTime: Date;
  isRateLimited: boolean;
}
