import nodemailer from 'nodemailer'
import { EmailOptions } from '../types'

class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private isDevelopment: boolean
  private brandName: string = 'EdgeAi'
  private brandColor: string = '#5046E5'
  private brandSecondaryColor: string = '#282828'
  private brandAccentColor: string = '#667085'

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    
    // Get email configuration from environment variables
    const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com'
    const emailPort = parseInt(process.env.EMAIL_PORT || '587')
    const emailUser = process.env.EMAIL_USER
    const emailPass = process.env.EMAIL_PASS
    
    if (emailUser && emailPass) {
      try {
        console.log(`[Email Service] Configuring SMTP with host: ${emailHost}, port: ${emailPort}, user: ${emailUser}`)
        this.transporter = nodemailer.createTransport({
          host: emailHost,
          port: emailPort,
          secure: false, // true for 465, false for other ports
          auth: {
            user: emailUser,
            pass: emailPass
          },
          tls: {
            rejectUnauthorized: false
          }
        })
        console.log('✅ Email service configured successfully with SMTP')
      } catch (error) {
        console.error('Email service configuration failed:', error)
        this.transporter = null
      }
    } else {
      console.log('Email service not configured - running in development mode')
      console.log('Required environment variables: EMAIL_USER, EMAIL_PASS')
      console.log('Current values: EMAIL_USER=' + (emailUser ? 'SET' : 'NOT SET'), 'EMAIL_PASS=' + (emailPass ? 'SET' : 'NOT SET'))
    }
  }

  /**
   * Generate email template wrapper with consistent styling
   */
  private generateEmailTemplate(content: string, showFooter: boolean = true): string {
    const footer = showFooter ? `
      <div style="background-color: #f8fafc; padding: 24px; margin-top: 32px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          This is an automated email from ${this.brandName}. Please do not reply.
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          © ${new Date().getFullYear()} ${this.brandName}. All rights reserved.
        </p>
      </div>
    ` : ''

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
    `
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      if (this.isDevelopment) {
        console.log('[DEV EMAIL] To:', to)
        console.log('[DEV EMAIL] Subject:', subject)
        console.log('[DEV EMAIL] HTML:', html)
        return
      }
      throw new Error('Email service not configured')
    }

    const mailOptions: EmailOptions = {
      to,
      subject,
      html: this.generateEmailTemplate(html)
    }

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER as string,
      ...mailOptions
    })
  }
}

const emailService = new EmailService()

export async function sendVerificationEmail(email: string, token: string, firstName?: string) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`
  await emailService.send(email, `Verify Your Email`, `Verify your email: <a href="${url}">${url}</a>`) 
}

export async function sendPasswordResetEmail(email: string, token: string, firstName?: string) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`
  await emailService.send(email, `Reset Your Password`, `Reset your password: <a href="${url}">${url}</a>`) 
}

export async function sendWelcomeEmail(email: string, firstName: string) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account`
  await emailService.send(email, `Welcome`, `Welcome to EdgeAi! <a href="${url}">Go to dashboard</a>`) 
}

export async function sendResendVerificationEmail(email: string, token: string, firstName?: string) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`
  await emailService.send(email, `New Verification Email`, `Verify your email: <a href="${url}">${url}</a>`) 
}


