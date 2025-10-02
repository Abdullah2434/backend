// ==================== VALIDATION UTILITY ====================

import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { ResponseHelper } from "./response";

export class ValidationHelper {
  // ==================== EXPRESS VALIDATOR HELPERS ====================

  static handleValidationErrors(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((error) => ({
        field: error.type === "field" ? (error as any).path : "unknown",
        message: error.msg,
        value: error.type === "field" ? (error as any).value : undefined,
      }));

      ResponseHelper.validationError(res, "Validation failed", formattedErrors);
      return;
    }

    next();
  }

  // ==================== EMAIL VALIDATION ====================

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ==================== PASSWORD VALIDATION ====================

  static isValidPassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ==================== PHONE VALIDATION ====================

  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
  }

  // ==================== URL VALIDATION ====================

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== OBJECT ID VALIDATION ====================

  static isValidObjectId(id: string): boolean {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
  }

  // ==================== STRING VALIDATION ====================

  static isNotEmpty(value: any): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }

  static isMinLength(value: string, minLength: number): boolean {
    return value.length >= minLength;
  }

  static isMaxLength(value: string, maxLength: number): boolean {
    return value.length <= maxLength;
  }

  // ==================== NUMBER VALIDATION ====================

  static isPositiveNumber(value: any): boolean {
    return typeof value === "number" && value > 0;
  }

  static isNonNegativeNumber(value: any): boolean {
    return typeof value === "number" && value >= 0;
  }

  // ==================== DATE VALIDATION ====================

  static isValidDate(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  static isFutureDate(date: Date): boolean {
    return date > new Date();
  }

  static isPastDate(date: Date): boolean {
    return date < new Date();
  }
}

export default ValidationHelper;
