import { EmailSenderService } from "./email-sender.service";
import { EmailTemplateService } from "./email-template.service";
import {
  ContactFormNotificationData,
  ContactFormConfirmationData,
} from "../types/email.types";

export class EmailContactService {
  private sender: EmailSenderService;
  private template: EmailTemplateService;

  constructor(sender: EmailSenderService, template: EmailTemplateService) {
    this.sender = sender;
    this.template = template;
  }

  public async sendContactFormNotification(
    data: ContactFormNotificationData
  ): Promise<void> {
    const { adminEmail, fullName, position, email, phone, question } = data;

    const content = `
      ${this.template.createSection(
        "New Contact Form Submission",
        "A new message has been received through the contact form on your website."
      )}
      
      ${this.template.createInfoBox(
        "Contact Information:",
        `
          <p><strong>Full Name:</strong> ${fullName}</p>
          <p><strong>Position/Title:</strong> ${position}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
        `
      )}
      
      ${this.template.createInfoBox(
        "Message:",
        `<p>${question.replace(/\n/g, "<br>")}</p>`
      )}
      
      ${this.template.createAlertBox(
        "This message was sent from the contact form on your website. Please respond directly to the customer's email address.",
        "info"
      )}
      
      ${this.template.createButton(
        "Reply to Customer",
        `mailto:${email}?subject=Re: Your inquiry from EdgeAI`
      )}
    `;

    await this.sender.send(
      adminEmail,
      `Contact Form: ${fullName} - ${position}`,
      content
    );
  }

  public async sendContactFormConfirmation(
    data: ContactFormConfirmationData
  ): Promise<void> {
    const { to, fullName, question } = data;

    const content = `
      ${this.template.createSection(
        "Thank you for your message!",
        `Hi ${fullName}, we have received your question and will get back to you as soon as possible.`
      )}
      
      ${this.template.createInfoBox(
        "Your Message:",
        `<p>${question.replace(/\n/g, "<br>")}</p>`
      )}
      
      ${this.template.createInfoBox(
        "What Happens Next?",
        this.template.createList([
          "Our team will review your message",
          "We'll respond within 24 hours",
          "Check your email for our reply",
          "Feel free to follow up if needed",
        ])
      )}
      
      ${this.template.createInfoBox(
        "Need Immediate Help?",
        this.template.createList([
          "Check our FAQ section",
          "Browse our knowledge base",
          "Join our community forum",
          "Schedule a demo call",
        ])
      )}
      
      ${this.template.createParagraph("Best regards,<br>Support Team")}
    `;

    await this.sender.send(to, "Thank you for contacting us", content);
  }

  public async sendSupportTicketNotification(
    adminEmail: string,
    ticketData: {
      ticketId: string;
      customerName: string;
      customerEmail: string;
      subject: string;
      priority: "low" | "medium" | "high" | "urgent";
      description: string;
    }
  ): Promise<void> {
    const {
      ticketId,
      customerName,
      customerEmail,
      subject,
      priority,
      description,
    } = ticketData;

    const priorityColors = {
      low: "#22c55e",
      medium: "#f59e0b",
      high: "#ef4444",
      urgent: "#dc2626",
    };

    const content = `
      ${this.template.createSection(
        "New Support Ticket Created",
        `A new support ticket has been created and requires attention.`
      )}
      
      ${this.template.createInfoBox(
        "Ticket Details:",
        `
          <p><strong>Ticket ID:</strong> ${ticketId}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Priority:</strong> <span style="color: ${
            priorityColors[priority]
          };">${priority.toUpperCase()}</span></p>
        `
      )}
      
      ${this.template.createInfoBox(
        "Description:",
        `<p>${description.replace(/\n/g, "<br>")}</p>`
      )}
      
      ${this.template.createButton(
        "View Ticket",
        `${process.env.ADMIN_PANEL_URL || "#"}/tickets/${ticketId}`
      )}
      
      ${this.template.createAlertBox(
        "Please respond to this ticket within the SLA timeframe based on priority level.",
        priority === "urgent" || priority === "high" ? "error" : "warning"
      )}
    `;

    await this.sender.send(
      adminEmail,
      `[${priority.toUpperCase()}] Support Ticket #${ticketId}: ${subject}`,
      content
    );
  }

  public async sendSupportTicketResponse(
    customerEmail: string,
    responseData: {
      ticketId: string;
      customerName: string;
      subject: string;
      response: string;
      agentName: string;
    }
  ): Promise<void> {
    const { ticketId, customerName, subject, response, agentName } =
      responseData;

    const content = `
      ${this.template.createSection(
        "Response to Your Support Ticket",
        `Hi ${customerName}, we have a response to your support ticket.`
      )}
      
      ${this.template.createInfoBox(
        "Ticket Information:",
        `
          <p><strong>Ticket ID:</strong> ${ticketId}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Responded by:</strong> ${agentName}</p>
        `
      )}
      
      ${this.template.createInfoBox(
        "Response:",
        `<p>${response.replace(/\n/g, "<br>")}</p>`
      )}
      
      ${this.template.createButton(
        "View Full Ticket",
        `${process.env.FRONTEND_URL || "#"}/support/tickets/${ticketId}`
      )}
      
      ${this.template.createInfoBox(
        "Need Further Assistance?",
        this.template.createList([
          "Reply to this email to continue the conversation",
          "Create a new support ticket",
          "Schedule a call with our team",
          "Check our knowledge base",
        ])
      )}
      
      ${this.template.createParagraph(
        "Best regards,<br>${agentName}<br>Support Team"
      )}
    `;

    await this.sender.send(
      customerEmail,
      `Re: ${subject} [Ticket #${ticketId}]`,
      content
    );
  }
}
