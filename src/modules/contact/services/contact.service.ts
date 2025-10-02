import * as crypto from "crypto";
import {
  sendContactFormNotification,
  sendContactFormConfirmation,
} from "../../../modules/shared/email";
import {
  ContactFormData,
  ContactSubmissionResult,
  ContactEmailData,
  ContactConfirmationData,
  ContactConfig,
  ContactError,
  EmailError,
  ValidationError,
} from "../types/contact.types";

export class ContactService {
  private readonly config: ContactConfig;

  constructor() {
    this.config = {
      adminEmail:
        process.env.CONTACT_EMAIL ||
        process.env.ADMIN_EMAIL ||
        "hrehman@techtiz.co",
      contactEmail: process.env.CONTACT_EMAIL || "contact@edgeairealty.com",
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 3, // 3 submissions per window
      maxQuestionLength: 2000,
      maxNameLength: 100,
      maxPositionLength: 100,
      maxPhoneLength: 20,
    };
  }

  // ==================== CONTACT FORM SUBMISSION ====================

  async submitContactForm(
    formData: ContactFormData
  ): Promise<ContactSubmissionResult> {
    try {
      // Validate form data
      this.validateContactFormData(formData);

      // Generate submission ID
      const submissionId = this.generateSubmissionId();

      // Prepare email data
      const emailData: ContactEmailData = {
        fullName: formData.fullName,
        position: formData.position,
        email: formData.email,
        phone: formData.phone,
        question: formData.question,
        adminEmail: this.config.adminEmail,
      };

      const confirmationData: ContactConfirmationData = {
        email: formData.email,
        fullName: formData.fullName,
        question: formData.question,
      };

      // Send emails
      await this.sendContactEmails(emailData, confirmationData);

      // Log successful submission
      this.logContactSubmission(submissionId, formData);

      return {
        success: true,
        message:
          "Contact form submitted successfully. We'll get back to you soon!",
        submissionId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof ContactError) {
        throw error;
      }
      throw new ContactError("Failed to submit contact form", 500);
    }
  }

  // ==================== EMAIL MANAGEMENT ====================

  private async sendContactEmails(
    emailData: ContactEmailData,
    confirmationData: ContactConfirmationData
  ): Promise<void> {
    try {
      // Send notification to admin
      await sendContactFormNotification(
        emailData.adminEmail,
        emailData.fullName,
        emailData.position,
        emailData.email,
        emailData.phone,
        emailData.question
      );

      // Send confirmation to user
      await sendContactFormConfirmation(
        confirmationData.email,
        confirmationData.fullName,
        confirmationData.question
      );
    } catch (error) {
      throw new EmailError("Failed to send contact form emails");
    }
  }

  // ==================== VALIDATION ====================

  private validateContactFormData(formData: ContactFormData): void {
    const errors: string[] = [];

    // Validate full name
    if (!formData.fullName || formData.fullName.trim().length === 0) {
      errors.push("Full name is required");
    } else if (formData.fullName.length > this.config.maxNameLength) {
      errors.push(
        `Full name must be less than ${this.config.maxNameLength} characters`
      );
    }

    // Validate position
    if (!formData.position || formData.position.trim().length === 0) {
      errors.push("Position/Title is required");
    } else if (formData.position.length > this.config.maxPositionLength) {
      errors.push(
        `Position/Title must be less than ${this.config.maxPositionLength} characters`
      );
    }

    // Validate email
    if (!formData.email || formData.email.trim().length === 0) {
      errors.push("Email is required");
    } else if (!this.isValidEmail(formData.email)) {
      errors.push("Please provide a valid email address");
    }

    // Validate phone
    if (!formData.phone || formData.phone.trim().length === 0) {
      errors.push("Phone number is required");
    } else if (!this.isValidPhone(formData.phone)) {
      errors.push("Please provide a valid phone number");
    }

    // Validate question
    if (!formData.question || formData.question.trim().length === 0) {
      errors.push("Question is required");
    } else if (formData.question.length < 10) {
      errors.push("Question must be at least 10 characters long");
    } else if (formData.question.length > this.config.maxQuestionLength) {
      errors.push(
        `Question must be less than ${this.config.maxQuestionLength} characters`
      );
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join(", "));
    }
  }

  // ==================== UTILITY METHODS ====================

  private generateSubmissionId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString("hex");
    return `contact_${timestamp}_${random}`;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
  }

  private logContactSubmission(
    submissionId: string,
    formData: ContactFormData
  ): void {
    const logData = {
      submissionId,
      timestamp: new Date().toISOString(),
      email: formData.email,
      fullName: formData.fullName,
      position: formData.position,
      questionLength: formData.question.length,
    };

    console.log(
      "📧 Contact form submission:",
      JSON.stringify(logData, null, 2)
    );
  }

  // ==================== CONFIGURATION ====================

  getConfig(): ContactConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ContactConfig>): void {
    this.config.adminEmail = newConfig.adminEmail || this.config.adminEmail;
    this.config.contactEmail =
      newConfig.contactEmail || this.config.contactEmail;
    this.config.rateLimitWindow =
      newConfig.rateLimitWindow || this.config.rateLimitWindow;
    this.config.rateLimitMax =
      newConfig.rateLimitMax || this.config.rateLimitMax;
    this.config.maxQuestionLength =
      newConfig.maxQuestionLength || this.config.maxQuestionLength;
    this.config.maxNameLength =
      newConfig.maxNameLength || this.config.maxNameLength;
    this.config.maxPositionLength =
      newConfig.maxPositionLength || this.config.maxPositionLength;
    this.config.maxPhoneLength =
      newConfig.maxPhoneLength || this.config.maxPhoneLength;
  }

  // ==================== ANALYTICS (Future Enhancement) ====================

  async getContactStats(): Promise<{
    totalSubmissions: number;
    submissionsToday: number;
    submissionsThisWeek: number;
    submissionsThisMonth: number;
  }> {
    // This would typically query a database
    // For now, return mock data
    return {
      totalSubmissions: 0,
      submissionsToday: 0,
      submissionsThisWeek: 0,
      submissionsThisMonth: 0,
    };
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      email: "available" | "unavailable";
      validation: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      // Check email service availability
      const emailAvailable = !!(
        process.env.EMAIL_USER && process.env.EMAIL_PASS
      );

      return {
        status: emailAvailable ? "healthy" : "unhealthy",
        services: {
          email: emailAvailable ? "available" : "unavailable",
          validation: "available",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          email: "unavailable",
          validation: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default ContactService;
