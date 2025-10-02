// ==================== ERROR HANDLER MIDDLEWARE ====================

import { Request, Response, NextFunction } from "express";
import { ApiError } from "./api.error";
import { ValidationError } from "./validation.error";
import { DatabaseError } from "./database.error";
import logger from "../utils/logger";
import { ResponseHelper } from "../utils/response";

export interface ErrorResponse {
  success: false;
  message: string;
  error?: any;
  timestamp: string;
  path: string;
  stack?: string;
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";
  let errorDetails: any = undefined;

  // ==================== ERROR TYPE HANDLING ====================

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;

    // Log API errors
    logger.error(`API Error: ${message}`, {
      statusCode,
      path: req.path,
      method: req.method,
      stack: error.stack,
    });
  } else if (error instanceof ValidationError) {
    statusCode = 400;
    message = error.message;
    errorDetails = error.errors;

    // Log validation errors
    logger.warn(`Validation Error: ${message}`, {
      path: req.path,
      method: req.method,
      errors: error.errors,
    });
  } else if (error instanceof DatabaseError) {
    statusCode = 500;
    message = error.message;
    errorDetails = {
      operation: error.operation,
      originalError: error.originalError,
    };

    // Log database errors
    logger.error(`Database Error: ${message}`, {
      operation: error.operation,
      path: req.path,
      method: req.method,
      originalError: error.originalError,
    });
  } else {
    // Log unexpected errors
    logger.error(`Unexpected Error: ${error.message}`, {
      path: req.path,
      method: req.method,
      stack: error.stack,
    });
  }

  // ==================== RESPONSE FORMATTING ====================

  const errorResponse: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Add error details if available
  if (errorDetails) {
    errorResponse.error = errorDetails;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === "development" && error.stack) {
    errorResponse.stack = error.stack;
  }

  // ==================== SEND RESPONSE ====================

  res.status(statusCode).json(errorResponse);
};

// ==================== ASYNC ERROR WRAPPER ====================

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ==================== 404 HANDLER ====================

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = ApiError.notFound(
    `Route ${req.originalUrl} not found`,
    req.path
  );
  next(error);
};

export default errorHandler;
