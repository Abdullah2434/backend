import { Request } from "express";
import { IUser } from "../../../database/models/User";

// ==================== REQUEST TYPES ====================
export interface RegisterRequest extends Request {
  body: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
  };
}

export interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

export interface GoogleLoginRequest extends Request {
  body: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface ForgotPasswordRequest extends Request {
  body: {
    email: string;
  };
}

export interface ResetPasswordRequest extends Request {
  body: {
    resetToken: string;
    newPassword: string;
  };
}

export interface UpdateProfileRequest extends Request {
  body: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

export interface VerifyEmailRequest extends Request {
  query: {
    token: string;
  };
}

export interface CheckEmailRequest extends Request {
  query: {
    email: string;
  };
}

export interface ValidateTokenRequest extends Request {
  body: {
    token: string;
  };
}

// ==================== RESPONSE TYPES ====================
export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: UserResponse;
    accessToken?: string;
    isNewUser?: boolean;
    requiresVerification?: boolean;
    email?: string;
    exists?: boolean;
    isVerified?: boolean;
    isValid?: boolean;
    tokenType?: "access" | "reset";
    hash?: string;
    errors?: ValidationErrorData[];
  };
}

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isEmailVerified: boolean;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== SERVICE TYPES ====================
export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface GoogleUserData {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface ResetPasswordData {
  resetToken: string;
  newPassword: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface AuthResult {
  user: IUser;
  accessToken: string;
}

export interface GoogleAuthResult {
  user: IUser;
  accessToken: string;
  isNewUser: boolean;
}

export interface TokenValidationResult {
  isValid: boolean;
  user?: IUser;
  tokenType?: "access" | "reset";
}

// ==================== JWT TYPES ====================
export interface JwtPayload {
  userId: string;
  email: string;
  type?: "reset";
  iat?: number;
  exp?: number;
}

// ==================== VALIDATION TYPES ====================
export interface ValidationErrorData {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorData[];
}

// ==================== EMAIL TYPES ====================
export interface EmailVerificationData {
  email: string;
  token: string;
  firstName: string;
}

export interface PasswordResetData {
  email: string;
  token: string;
  firstName: string;
}

// ==================== CONFIG TYPES ====================
export interface AuthConfig {
  jwtSecret: string;
  tokenExpiry: string;
  resetTokenExpiry: string;
  bcryptRounds: number;
  emailVerificationExpiry: number;
  passwordResetExpiry: number;
}

// ==================== ERROR TYPES ====================
export interface AuthError extends Error {
  statusCode?: number;
  code?: string;
  field?: string;
}

export class AuthenticationError extends Error implements AuthError {
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode: number = 401,
    code: string = "AUTH_ERROR"
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends Error implements AuthError {
  statusCode: number;
  code: string;
  field?: string;

  constructor(
    message: string,
    field?: string,
    statusCode: number = 400,
    code: string = "VALIDATION_ERROR"
  ) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
  }
}

export class NotFoundError extends Error implements AuthError {
  statusCode: number;
  code: string;

  constructor(
    message: string = "Resource not found",
    statusCode: number = 404,
    code: string = "NOT_FOUND"
  ) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ConflictError extends Error implements AuthError {
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode: number = 409,
    code: string = "CONFLICT"
  ) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
