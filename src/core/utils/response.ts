// ==================== RESPONSE UTILITY ====================

import { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
  path?: string;
}

export class ResponseHelper {
  static success<T>(
    res: Response,
    data: T,
    message: string = "Success",
    statusCode: number = 200
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      path: res.req.path,
    };

    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string = "Internal Server Error",
    statusCode: number = 500,
    error?: string
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: res.req.path,
    };

    return res.status(statusCode).json(response);
  }

  static validationError(
    res: Response,
    message: string = "Validation Error",
    errors?: any
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: errors,
      timestamp: new Date().toISOString(),
      path: res.req.path,
    };

    return res.status(400).json(response);
  }

  static unauthorized(
    res: Response,
    message: string = "Unauthorized"
  ): Response {
    return this.error(res, message, 401);
  }

  static forbidden(res: Response, message: string = "Forbidden"): Response {
    return this.error(res, message, 403);
  }

  static notFound(res: Response, message: string = "Not Found"): Response {
    return this.error(res, message, 404);
  }

  static conflict(res: Response, message: string = "Conflict"): Response {
    return this.error(res, message, 409);
  }
}

export default ResponseHelper;
