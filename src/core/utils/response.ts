import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class ResponseHelper {
  static success<T>(
    res: Response,
    message: string,
    data?: T,
    statusCode: number = 200,
    meta?: any
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      ...(data && { data }),
      ...(meta && { meta })
    };

    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    data?: any
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      ...(data && { data })
    };

    return res.status(statusCode).json(response);
  }

  static created<T>(
    res: Response,
    message: string,
    data?: T
  ): Response {
    return this.success(res, message, data, 201);
  }

  static noContent(res: Response, message: string = 'No content'): Response {
    return this.success(res, message, undefined, 204);
  }

  static badRequest(
    res: Response,
    message: string = 'Bad request',
    data?: any
  ): Response {
    return this.error(res, message, 400, data);
  }

  static unauthorized(
    res: Response,
    message: string = 'Unauthorized'
  ): Response {
    return this.error(res, message, 401);
  }

  static forbidden(
    res: Response,
    message: string = 'Forbidden'
  ): Response {
    return this.error(res, message, 403);
  }

  static notFound(
    res: Response,
    message: string = 'Not found'
  ): Response {
    return this.error(res, message, 404);
  }

  static conflict(
    res: Response,
    message: string = 'Conflict'
  ): Response {
    return this.error(res, message, 409);
  }

  static internalError(
    res: Response,
    message: string = 'Internal server error'
  ): Response {
    return this.error(res, message, 500);
  }
}
