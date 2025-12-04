/**
 * Shared controller helper functions
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types";
import { ZodError } from "zod";

/**
 * Get user ID from authenticated request
 */
export function getUserIdFromRequest(req: AuthenticatedRequest): string {
  if (!req.user?._id) {
    throw new Error("User not authenticated");
  }
  return req.user._id.toString();
}

/**
 * Extract access token from request headers
 */
export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.replace("Bearer ", "") || null;
}

/**
 * Format validation errors from Zod
 */
export function formatValidationErrors(error: ZodError): Array<{
  field: string;
  message: string;
}> {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));
}

/**
 * Determine HTTP status code based on error message
 */
export function getErrorStatus(error: Error): number {
  const message = error.message.toLowerCase();

  if (
    message.includes("token") ||
    message.includes("not authenticated") ||
    message.includes("user not found") ||
    message.includes("unauthorized")
  ) {
    return 401;
  }

  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("invalid") || message.includes("required")) {
    return 400;
  }

  return 500;
}

/**
 * Handle controller errors consistently
 */
export function handleControllerError(
  error: unknown,
  res: Response,
  functionName: string,
  defaultMessage: string
): Response {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`Error in ${functionName}:`, err);

  const status = getErrorStatus(err);
  return res.status(status).json({
    success: false,
    message: err.message || defaultMessage,
    error: err.message || "Unknown error",
  });
}

