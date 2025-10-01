import { Response } from "express";
import ContactService from "../services/contact.service";
import { ContactFormRequest, ContactResponse } from "../types/contact.types";
import { logContactEvent, logContactError } from "../utils/contact.utils";

const contactService = new ContactService();

const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
): void => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

export const submitContactForm = async (
  req: ContactFormRequest,
  res: Response
): Promise<void> => {
  try {
    const { fullName, position, email, phone, question } = req.body;

    logContactEvent("contact_form_submission_attempt", {
      email: email,
      fullName: fullName,
      position: position,
      questionLength: question.length,
    });

    const result = await contactService.submitContactForm({
      fullName,
      position,
      email,
      phone,
      question,
    });

    logContactEvent("contact_form_submission_success", {
      submissionId: result.submissionId,
      email: email,
    });

    sendResponse(res, 200, result.message, {
      submissionId: result.submissionId,
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    logContactError(error, {
      email: req.body.email,
      fullName: req.body.fullName,
    });

    sendResponse(
      res,
      error.statusCode || 500,
      error.message || "Failed to submit contact form. Please try again later."
    );
  }
};

export const getContactStats = async (
  req: any,
  res: Response
): Promise<void> => {
  try {
    const stats = await contactService.getContactStats();
    sendResponse(res, 200, "Contact statistics retrieved successfully", stats);
  } catch (error: any) {
    logContactError(error, { action: "get_contact_stats" });
    sendResponse(res, 500, "Failed to retrieve contact statistics");
  }
};

export const healthCheck = async (req: any, res: Response): Promise<void> => {
  try {
    const health = await contactService.healthCheck();
    const statusCode = health.status === "healthy" ? 200 : 503;
    sendResponse(
      res,
      statusCode,
      `Contact service is ${health.status}`,
      health
    );
  } catch (error: any) {
    logContactError(error, { action: "health_check" });
    sendResponse(res, 503, "Contact service is unhealthy", {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
    });
  }
};
