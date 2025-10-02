import { IUser } from "../../../models/User";

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ResetPasswordData {
  resetToken: string;
  newPassword: string;
}

export interface GoogleUserData {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  user: IUser;
  accessToken: string;
}

export interface GoogleAuthResult extends AuthResult {
  isNewUser: boolean;
}

export interface JwtPayload {
  userId: string;
  email: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isEmailVerified: boolean;
  googleId?: string;
}
