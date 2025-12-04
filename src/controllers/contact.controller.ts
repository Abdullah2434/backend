import { Request, Response } from "express";
import { ApiResponse, ValidationError } from "../types";
import {
  sendContactFormNotification,
  sendContactFormConfirmation,
} from "../services/email.service";
import { contactFormSchema } from "../validations/contact.validations";

export const submitContactForm = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = contactFormSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors: ValidationError[] = validationResult.error.errors.map(
        (err) => ({
          field: err.path.join("."),
          message: err.message,
        })
      );

      const errorResponse = {
        success: false,
        message: "Validation failed",
        errors,
      };
      return res.status(400).json(errorResponse);
    }

    const { fullName, position, email, phone, question } =
      validationResult.data;

    // Send email notification to admin
    await sendContactFormNotification(
      process.env.CONTACT_EMAIL ||
        process.env.ADMIN_EMAIL ||
        "hrehman@techtiz.co",
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
      message:
        "Contact form submitted successfully. We'll get back to you soon!",
    };

    res.status(200).json(successResponse);
  } catch (error) {
    const errorResponse: ApiResponse = {
      success: false,
      message: "Failed to submit contact form. Please try again later.",
    };

    res.status(500).json(errorResponse);
  }
};
