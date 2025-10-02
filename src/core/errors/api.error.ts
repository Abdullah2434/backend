// ==================== API ERROR CLASS ====================

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public timestamp: string;
  public path?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    path?: string
  ) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.path = path;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  // ==================== STATIC ERROR CREATORS ====================

  static badRequest(message: string = "Bad Request", path?: string): ApiError {
    return new ApiError(message, 400, true, path);
  }

  static unauthorized(
    message: string = "Unauthorized",
    path?: string
  ): ApiError {
    return new ApiError(message, 401, true, path);
  }

  static forbidden(message: string = "Forbidden", path?: string): ApiError {
    return new ApiError(message, 403, true, path);
  }

  static notFound(message: string = "Not Found", path?: string): ApiError {
    return new ApiError(message, 404, true, path);
  }

  static conflict(message: string = "Conflict", path?: string): ApiError {
    return new ApiError(message, 409, true, path);
  }

  static unprocessableEntity(
    message: string = "Unprocessable Entity",
    path?: string
  ): ApiError {
    return new ApiError(message, 422, true, path);
  }

  static tooManyRequests(
    message: string = "Too Many Requests",
    path?: string
  ): ApiError {
    return new ApiError(message, 429, true, path);
  }

  static internalServerError(
    message: string = "Internal Server Error",
    path?: string
  ): ApiError {
    return new ApiError(message, 500, true, path);
  }

  static serviceUnavailable(
    message: string = "Service Unavailable",
    path?: string
  ): ApiError {
    return new ApiError(message, 503, true, path);
  }

  // ==================== ERROR SERIALIZATION ====================

  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      path: this.path,
      stack: this.stack,
    };
  }
}

export default ApiError;
