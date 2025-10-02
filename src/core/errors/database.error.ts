// ==================== DATABASE ERROR CLASS ====================

import { ApiError } from "./api.error";

export class DatabaseError extends ApiError {
  public operation: string;
  public originalError?: any;

  constructor(
    message: string,
    operation: string,
    originalError?: any,
    path?: string
  ) {
    super(message, 500, true, path);
    this.name = "DatabaseError";
    this.operation = operation;
    this.originalError = originalError;
  }

  // ==================== STATIC ERROR CREATORS ====================

  static connectionFailed(originalError?: any, path?: string): DatabaseError {
    return new DatabaseError(
      "Database connection failed",
      "connection",
      originalError,
      path
    );
  }

  static queryFailed(
    operation: string,
    originalError?: any,
    path?: string
  ): DatabaseError {
    return new DatabaseError(
      `Database query failed: ${operation}`,
      operation,
      originalError,
      path
    );
  }

  static recordNotFound(
    model: string,
    id: string,
    path?: string
  ): DatabaseError {
    return new DatabaseError(
      `${model} with id '${id}' not found`,
      "find",
      undefined,
      path
    );
  }

  static duplicateKey(field: string, value: any, path?: string): DatabaseError {
    return new DatabaseError(
      `Duplicate key error: ${field} '${value}' already exists`,
      "create",
      undefined,
      path
    );
  }

  static constraintViolation(constraint: string, path?: string): DatabaseError {
    return new DatabaseError(
      `Database constraint violation: ${constraint}`,
      "constraint",
      undefined,
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
      operation: this.operation,
      originalError: this.originalError,
      stack: this.stack,
    };
  }
}

export default DatabaseError;
