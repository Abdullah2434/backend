// ==================== VALIDATION ERROR CLASS ====================

import { ApiError } from "./api.error";

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

export class ValidationError extends ApiError {
  public errors: ValidationErrorDetail[];

  constructor(
    message: string = "Validation Error",
    errors: ValidationErrorDetail[] = [],
    path?: string
  ) {
    super(message, 400, true, path);
    this.name = "ValidationError";
    this.errors = errors;
  }

  // ==================== STATIC ERROR CREATORS ====================

  static fieldRequired(field: string, path?: string): ValidationError {
    return new ValidationError(
      `Field '${field}' is required`,
      [{ field, message: `Field '${field}' is required` }],
      path
    );
  }

  static fieldInvalid(
    field: string,
    value: any,
    message: string,
    path?: string
  ): ValidationError {
    return new ValidationError(
      `Field '${field}' is invalid`,
      [{ field, message, value }],
      path
    );
  }

  static multipleErrors(
    errors: ValidationErrorDetail[],
    path?: string
  ): ValidationError {
    return new ValidationError(
      "Multiple validation errors occurred",
      errors,
      path
    );
  }

  // ==================== ERROR SERIALIZATION ====================

  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      path: this.path,
      errors: this.errors,
      stack: this.stack,
    };
  }
}

export default ValidationError;
