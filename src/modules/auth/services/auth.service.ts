import AuthTokenService from "./auth-token.service";
import AuthUserService from "./auth-user.service";
import AuthPasswordService from "./auth-password.service";
import AuthVerificationService from "./auth-verification.service";
import AuthGoogleService from "./auth-google.service";
import User from "../../../database/models/User";
import {
  RegisterData,
  LoginData,
  ResetPasswordData,
  GoogleUserData,
  UpdateProfileData,
  AuthResult,
  GoogleAuthResult,
  TokenValidationResult,
  AuthConfig,
} from "../types/auth.types";

export class AuthService {
  private readonly tokenService: AuthTokenService;
  private readonly userService: AuthUserService;
  private readonly passwordService: AuthPasswordService;
  private readonly verificationService: AuthVerificationService;
  private readonly googleService: AuthGoogleService;

  constructor() {
    this.tokenService = new AuthTokenService();
    this.userService = new AuthUserService();
    this.passwordService = new AuthPasswordService();
    this.verificationService = new AuthVerificationService();
    this.googleService = new AuthGoogleService();
  }

  // ==================== TOKEN MANAGEMENT ====================

  generateToken(userId: string, email: string): string {
    return this.tokenService.generateToken(userId, email);
  }

  generateResetToken(userId: string, email: string): string {
    return this.tokenService.generateResetToken(userId, email);
  }

  verifyToken(token: string): any {
    return this.tokenService.verifyToken(token);
  }

  decodeToken(token: string): any {
    return this.tokenService.decodeToken(token);
  }

  // ==================== USER REGISTRATION & LOGIN ====================

  async register(userData: RegisterData): Promise<AuthResult> {
    return this.userService.register(userData);
  }

  async login(loginData: LoginData): Promise<AuthResult> {
    return this.userService.login(loginData);
  }

  async getCurrentUser(token: string): Promise<any> {
    return this.userService.getCurrentUser(token);
  }

  async updateProfile(
    userId: string,
    updateData: UpdateProfileData
  ): Promise<any> {
    return this.userService.updateProfile(userId, updateData);
  }

  async logout(userId: string): Promise<void> {
    return this.userService.logout(userId);
  }

  // ==================== PASSWORD RESET ====================

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.passwordService.forgotPassword(email);
  }

  async resetPassword(
    resetData: ResetPasswordData
  ): Promise<{ message: string }> {
    return this.passwordService.resetPassword(resetData);
  }

  async validateResetToken(
    token: string
  ): Promise<{ isValid: boolean; message: string }> {
    return this.passwordService.validateResetToken(token);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return this.passwordService.changePassword(
      userId,
      currentPassword,
      newPassword
    );
  }

  // ==================== EMAIL VERIFICATION ====================

  async verifyEmail(token: string): Promise<{ message: string; user: any }> {
    return this.verificationService.verifyEmail(token);
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    return this.verificationService.resendVerificationEmail(email);
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    return this.verificationService.validateToken(token);
  }

  async checkEmailVerification(
    email: string
  ): Promise<{ exists: boolean; isVerified: boolean }> {
    return this.verificationService.checkEmailVerification(email);
  }

  async checkEmail(email: string): Promise<{ exists: boolean }> {
    return this.verificationService.checkEmail(email);
  }

  async clearExpiredTokens(): Promise<{
    message: string;
    clearedCount: number;
  }> {
    return this.verificationService.clearExpiredTokens();
  }

  // ==================== GOOGLE OAUTH ====================

  async googleLogin(googleData: GoogleUserData): Promise<GoogleAuthResult> {
    return this.googleService.googleLogin(googleData);
  }

  async linkGoogleAccount(
    userId: string,
    googleData: GoogleUserData
  ): Promise<{ message: string }> {
    return this.googleService.linkGoogleAccount(userId, googleData);
  }

  async unlinkGoogleAccount(userId: string): Promise<{ message: string }> {
    return this.googleService.unlinkGoogleAccount(userId);
  }

  async isGoogleAccountLinked(userId: string): Promise<boolean> {
    return this.googleService.isGoogleAccountLinked(userId);
  }

  // ==================== UTILITY METHODS ====================

  async getUserByEmail(email: string): Promise<any> {
    return this.userService.getUserByEmail(email);
  }

  async getUserById(userId: string): Promise<any> {
    return this.userService.getUserById(userId);
  }

  async hashPassword(password: string): Promise<string> {
    return this.passwordService.hashPassword(password);
  }

  async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return this.passwordService.comparePassword(password, hashedPassword);
  }

  // ==================== CONFIGURATION ====================

  getConfig(): AuthConfig {
    return this.tokenService.getConfig();
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      tokenService: "available" | "unavailable";
      userService: "available" | "unavailable";
      passwordService: "available" | "unavailable";
      verificationService: "available" | "unavailable";
      googleService: "available" | "unavailable";
    };
    timestamp: string;
  }> {
    try {
      const [
        tokenHealth,
        userHealth,
        passwordHealth,
        verificationHealth,
        googleHealth,
      ] = await Promise.all([
        this.tokenService.healthCheck(),
        this.userService.healthCheck(),
        this.passwordService.healthCheck(),
        this.verificationService.healthCheck(),
        this.googleService.healthCheck(),
      ]);

      const isHealthy =
        tokenHealth.status === "healthy" &&
        userHealth.status === "healthy" &&
        passwordHealth.status === "healthy" &&
        verificationHealth.status === "healthy" &&
        googleHealth.status === "healthy";

      return {
        status: isHealthy ? "healthy" : "unhealthy",
        services: {
          tokenService: tokenHealth.services.jwt,
          userService: userHealth.services.database,
          passwordService: passwordHealth.services.tokenService,
          verificationService: verificationHealth.services.tokenService,
          googleService: googleHealth.services.database,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          tokenService: "unavailable",
          userService: "unavailable",
          passwordService: "unavailable",
          verificationService: "unavailable",
          googleService: "unavailable",
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ==================== EMAIL CHECKING ====================

  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const user = await User.findOne({ email });
      return !!user;
    } catch (error) {
      return false;
    }
  }
}

export default AuthService;
