// ==================== EMAIL MODULE EXPORTS ====================

// Main service
export {
  EmailService,
  default as EmailServiceDefault,
} from "./services/email.service";

// Individual services
export { EmailConfigService } from "./services/email-config.service";
export { EmailTemplateService } from "./services/email-template.service";
export { EmailSenderService } from "./services/email-sender.service";
export { EmailAuthService } from "./services/email-auth.service";
export { EmailContactService } from "./services/email-contact.service";

// Types
export * from "./types/email.types";

// ==================== EMAIL MODULE CONFIGURATION ====================

export const emailModuleConfig = {
  name: "Email Module",
  version: "1.0.0",
  description:
    "Modular email service with authentication, contact, and template support",
  services: [
    "EmailConfigService",
    "EmailTemplateService",
    "EmailSenderService",
    "EmailAuthService",
    "EmailContactService",
    "EmailService",
  ],
  features: [
    "Email configuration management",
    "Template generation with branding",
    "SMTP email sending",
    "Authentication emails (verification, password reset, welcome)",
    "Contact form emails (notifications, confirmations)",
    "Subscription welcome emails",
    "Bulk email sending",
    "Template variable substitution",
    "Connection verification",
    "Health checks",
    "Development mode support",
  ],
  dependencies: ["nodemailer", "express"],
};

// ==================== CONVENIENCE EXPORTS ====================

// Create a singleton instance for easy importing
import { EmailService } from "./services/email.service";

const emailService = new EmailService();

// Export commonly used functions for backward compatibility
export const sendVerificationEmail =
  emailService.sendVerificationEmail.bind(emailService);
export const sendResendVerificationEmail =
  emailService.sendResendVerificationEmail.bind(emailService);
export const sendPasswordResetEmail =
  emailService.sendPasswordResetEmail.bind(emailService);
export const sendWelcomeEmail =
  emailService.sendWelcomeEmail.bind(emailService);
export const sendSubscriptionWelcomeEmail =
  emailService.sendSubscriptionWelcomeEmail.bind(emailService);
export const sendContactFormNotification =
  emailService.sendContactFormNotification.bind(emailService);
export const sendContactFormConfirmation =
  emailService.sendContactFormConfirmation.bind(emailService);
export const send = emailService.send.bind(emailService);

// Export the singleton instance
export { emailService };
