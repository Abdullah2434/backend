import { Request, Response } from "express";
import { z } from "zod";
import { ApiResponse, ValidationError } from "../types";
import { sendContactFormNotification, sendContactFormConfirmation } from "../services/email";

// Validation schema for contact form
const contactFormSchema = z.object({
  fullName: z.string().min(1, "Full Name is required").max(100, "Full Name too long"),
  position: z.string().min(1, "Position/Title is required").max(100, "Position/Title too long"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required").max(20, "Phone number too long"),
  question: z.string().min(10, "Question must be at least 10 characters").max(2000, "Question too long"),
});

export const submitContactForm = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = contactFormSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors: ValidationError[] = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      const errorResponse = {
        success: false,
        message: "Validation failed",
        errors
      };
      return res.status(400).json(errorResponse);
    }

    const { fullName, position, email, phone, question } = validationResult.data;

    // Send email notification to admin
    await sendContactFormNotification(
      process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || "admin@example.com",
      fullName,
      position,
      email,
      phone,
      question
    );

    // Send confirmation email to user
    await sendContactFormConfirmation(email, fullName, question);

    const successResponse: ApiResponse = {
      success: true,
      message: "Contact form submitted successfully. We'll get back to you soon!"
    };

    res.status(200).json(successResponse);

  } catch (error) {
    console.error("Contact form submission error:", error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: "Failed to submit contact form. Please try again later."
    };
    
    res.status(500).json(errorResponse);
  }
};
