# 🔧 Refactoring Example: Authentication Module

## 📋 Current Issues with `auth.controller.ts`

### Problems:

1. **420 lines** - Too large and complex
2. **Multiple responsibilities** - Auth, profile, password, verification
3. **Repetitive error handling** - Same pattern repeated
4. **No input validation** - Manual validation in each function
5. **Mixed concerns** - HTTP handling + business logic

## 🎯 Refactored Solution

### 1. Split into Focused Controllers

#### `src/modules/auth/controllers/auth.controller.ts` (80 lines)

```typescript
import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { TokenService } from "../services/token.service";
import { validateRequest } from "../validation/auth.validation";
import { ApiResponse } from "../../../core/types";
import { asyncHandler } from "../../../core/utils/asyncHandler";

export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService
  ) {}

  register = asyncHandler(async (req: Request, res: Response) => {
    const userData = validateRequest(req.body, "register");
    const result = await this.authService.register(userData);

    res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for verification.",
      data: {
        user: this.formatUserResponse(result.user),
        accessToken: result.accessToken,
      },
    });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const loginData = validateRequest(req.body, "login");
    const result = await this.authService.login(loginData);

    if (!result.user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email address before logging in.",
        data: {
          requiresVerification: true,
          email: result.user.email,
        },
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: this.formatUserResponse(result.user),
        accessToken: result.accessToken,
      },
    });
  });

  googleLogin = asyncHandler(async (req: Request, res: Response) => {
    const googleData = validateRequest(req.body, "googleLogin");
    const result = await this.authService.googleLogin(googleData);

    res.json({
      success: true,
      message: result.isNewUser
        ? "User registered successfully with Google"
        : "Login successful",
      data: {
        user: this.formatUserResponse(result.user),
        accessToken: result.accessToken,
        isNewUser: result.isNewUser,
      },
    });
  });

  private formatUserResponse(user: any) {
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      googleId: user.googleId,
    };
  }
}
```

#### `src/modules/auth/controllers/profile.controller.ts` (60 lines)

```typescript
import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { validateRequest } from "../validation/profile.validation";
import { asyncHandler } from "../../../core/utils/asyncHandler";

export class ProfileController {
  constructor(private authService: AuthService) {}

  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.authService.getCurrentUser(req.user.id);

    res.json({
      success: true,
      data: {
        user: this.formatUserResponse(user),
      },
    });
  });

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const updateData = validateRequest(req.body, "updateProfile");
    const updatedUser = await this.authService.updateProfile(
      req.user.id,
      updateData
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: this.formatUserResponse(updatedUser),
      },
    });
  });

  private formatUserResponse(user: any) {
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      googleId: user.googleId,
    };
  }
}
```

#### `src/modules/auth/controllers/password.controller.ts` (80 lines)

```typescript
import { Request, Response } from "express";
import { PasswordService } from "../services/password.service";
import { validateRequest } from "../validation/password.validation";
import { asyncHandler } from "../../../core/utils/asyncHandler";

export class PasswordController {
  constructor(private passwordService: PasswordService) {}

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = validateRequest(req.body, "forgotPassword");
    const result = await this.passwordService.forgotPassword(email);

    res.json({
      success: true,
      message: result.message,
    });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const resetData = validateRequest(req.body, "resetPassword");
    const result = await this.passwordService.resetPassword(resetData);

    res.json({
      success: true,
      message: result.message,
    });
  });

  validateResetToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = validateRequest(req.body, "validateResetToken");
    const result = await this.passwordService.validateResetToken(token);

    res.json({
      success: true,
      data: { isValid: result.isValid },
    });
  });
}
```

### 2. Centralized Error Handling

#### `src/core/utils/asyncHandler.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

#### `src/core/errors/AppError.ts`

```typescript
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
```

### 3. Input Validation

#### `src/modules/auth/validation/auth.validation.ts`

```typescript
import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const googleLoginSchema = z.object({
  googleId: z.string().min(1, "Google ID is required"),
  email: z.string().email("Invalid email format"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export const validateRequest = (data: any, schema: string) => {
  let validationSchema;

  switch (schema) {
    case "register":
      validationSchema = registerSchema;
      break;
    case "login":
      validationSchema = loginSchema;
      break;
    case "googleLogin":
      validationSchema = googleLoginSchema;
      break;
    default:
      throw new Error("Invalid validation schema");
  }

  return validationSchema.parse(data);
};
```

### 4. Service Layer Refactoring

#### `src/modules/auth/services/auth.service.ts` (150 lines)

```typescript
import { User } from "../models/user.model";
import { TokenService } from "./token.service";
import { EmailService } from "./email.service";
import { RegisterData, LoginData, GoogleUserData } from "../types/auth.types";

export class AuthService {
  constructor(
    private tokenService: TokenService,
    private emailService: EmailService
  ) {}

  async register(userData: RegisterData) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new AppError("User with this email already exists", 400);
    }

    const user = new User(userData);
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    const accessToken = this.tokenService.generateToken(
      user._id.toString(),
      user.email
    );
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      user.firstName
    );

    return { user, accessToken };
  }

  async login(loginData: LoginData) {
    const user = await User.findOne({ email: loginData.email }).select(
      "+password"
    );
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const isPasswordValid = await user.comparePassword(loginData.password);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    const accessToken = this.tokenService.generateToken(
      user._id.toString(),
      user.email
    );
    return { user, accessToken };
  }

  async googleLogin(googleData: GoogleUserData) {
    // Implementation here...
  }
}
```

## 📊 Benefits of Refactoring

### Before Refactoring:

- ❌ 420 lines in single file
- ❌ Multiple responsibilities
- ❌ Repetitive error handling
- ❌ No input validation
- ❌ Hard to test
- ❌ Difficult to maintain

### After Refactoring:

- ✅ 4 focused controllers (60-80 lines each)
- ✅ Single responsibility principle
- ✅ Centralized error handling
- ✅ Input validation with Zod
- ✅ Easy to test
- ✅ Easy to maintain
- ✅ Better type safety
- ✅ Consistent patterns

## 🚀 Implementation Steps

1. **Create new module structure**
2. **Move existing code to new files**
3. **Add validation and error handling**
4. **Update routes to use new controllers**
5. **Add tests for each component**
6. **Remove old files**

This refactoring reduces complexity, improves maintainability, and makes the code much easier to work with!
