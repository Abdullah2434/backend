import {
  EmailBrandConfig,
  EmailTemplate,
  EmailTemplateData,
} from "../types/email.types";

export class EmailTemplateService {
  private brandConfig: EmailBrandConfig;

  constructor(brandConfig: EmailBrandConfig) {
    this.brandConfig = brandConfig;
  }

  public generateEmailTemplate(content: string): string {
    const { brandName, brandColor, brandSecondaryColor, brandAccentColor } =
      this.brandConfig;

    const header = `
      <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandSecondaryColor} 100%); padding: 32px 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${brandName}
        </h1>
      </div>
    `;

    const footer = `
      <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          © 2024 ${brandName}. All rights reserved.
        </p>
        <p style="color: #94a3b8; margin: 0; font-size: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          This email was sent from an automated system. Please do not reply to this email.
        </p>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${brandName}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          ${header}
          <div style="padding: 32px;">
            ${content}
          </div>
          ${footer}
        </div>
      </body>
      </html>
    `;
  }

  public createButton(text: string, url: string, color?: string): string {
    const buttonColor = color || this.brandConfig.brandColor;
    return `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${url}" style="display: inline-block; background-color: ${buttonColor}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; transition: background-color 0.2s;">
          ${text}
        </a>
      </div>
    `;
  }

  public createAlertBox(
    message: string,
    type: "info" | "warning" | "error" | "success"
  ): string {
    const colors = {
      info: { bg: "#f0f9ff", border: "#0ea5e9", text: "#0c4a6e" },
      warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
      error: { bg: "#fef2f2", border: "#ef4444", text: "#dc2626" },
      success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
    };

    const color = colors[type];
    return `
      <div style="background-color: ${color.bg}; padding: 16px; border-radius: 6px; margin: 24px 0; border-left: 4px solid ${color.border};">
        <p style="color: ${color.text}; margin: 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${message}
        </p>
      </div>
    `;
  }

  public createInfoBox(title: string, content: string): string {
    return `
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${this.brandConfig.brandColor};">
        <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 18px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${title}
        </h3>
        <div style="color: #4b5563; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${content}
        </div>
      </div>
    `;
  }

  public createList(items: string[], ordered: boolean = false): string {
    const listTag = ordered ? "ol" : "ul";
    const listItems = items
      .map((item) => `<li style="margin: 4px 0;">${item}</li>`)
      .join("");

    return `
      <${listTag} style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        ${listItems}
      </${listTag}>
    `;
  }

  public createSection(title: string, content: string): string {
    return `
      <div style="margin: 24px 0;">
        <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${title}
        </h2>
        <div style="color: #6b7280; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          ${content}
        </div>
      </div>
    `;
  }

  public createParagraph(text: string, style?: string): string {
    const defaultStyle =
      "color: #6b7280; margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;";
    return `<p style="${style || defaultStyle}">${text}</p>`;
  }

  public createLink(text: string, url: string, color?: string): string {
    const linkColor = color || this.brandConfig.brandColor;
    return `<a href="${url}" style="color: ${linkColor}; word-break: break-all;">${text}</a>`;
  }
}
