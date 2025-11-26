import { Request, Response } from "express";
import AuthService from "../services/auth.service";
import { UserResponse, ApiResponse } from "../types";

const authService = new AuthService();

export async function register(req: Request, res: Response) {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const result = await authService.register({
      firstName,
      lastName,
      email,
      phone: phone || "",
      password,
    });

    return res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for verification.",
      data: {
        user: {
          id: result.user._id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          phone: result.user.phone,
          isEmailVerified: result.user.isEmailVerified,
        },
        accessToken: result.accessToken,
      },
    });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const result = await authService.login({ email, password });

    // Check if email is verified
    if (!result.user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email address before logging in. Check your inbox for the verification link.",
        data: {
          requiresVerification: true,
          email: result.user.email,
        },
      });
    }

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: result.user._id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          phone: result.user.phone,
          isEmailVerified: result.user.isEmailVerified,
        },
        accessToken: result.accessToken,
      },
    });
  } catch (e: any) {
    return res
      .status(401)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Access token is required" });
    }

    const user = await authService.getCurrentUser(token);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired access token" });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          isEmailVerified: user.isEmailVerified,
          googleId: user.googleId,
        },
      },
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Access token is required" });
    }

    const currentUser = await authService.getCurrentUser(token);
    if (!currentUser) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired access token" });
    }

    const { firstName, lastName, phone } = req.body;
    const updatedUser = await authService.updateProfile(
      currentUser._id.toString(),
      {
        firstName,
        lastName,
        phone,
      }
    );

    return res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: updatedUser._id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          phone: updatedUser.phone,
          isEmailVerified: updatedUser.isEmailVerified,
        },
      },
    });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (token) {
      const user = await authService.getCurrentUser(token);
      if (user) {
        await authService.logout(user._id.toString());
      }
    }
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (e: any) {
    return res.json({ success: true, message: "Logged out successfully" });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const result = await authService.forgotPassword(email);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Reset token and new password are required",
        });
    }

    const result = await authService.resetPassword({ resetToken, newPassword });
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const token = String(req.query.token || "");
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Verification token is required" });
    }

    const result = await authService.verifyEmail(token);
    return res.json({
      success: true,
      message: result.message,
      data: {
        user: {
          id: result.user._id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          phone: result.user.phone,
          isEmailVerified: result.user.isEmailVerified,
        },
      },
    });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const result = await authService.resendVerificationEmail(email);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function checkEmail(req: Request, res: Response) {
  try {
    const email = String(req.query.email || "");
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const exists = await authService.emailExists(email);
    return res.json({ success: true, data: { exists } });
  } catch (e: any) {
    return res
      .status(500)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function checkEmailVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const user = await authService.getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      data: {
        isVerified: user.isEmailVerified,
        email: user.email,
      },
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function validateToken(req: Request, res: Response) {
  try {
    const { token } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Token is required" });
    }

    const isValid = await authService.validateAccessToken(token);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const user = await authService.getCurrentUser(token);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // Check if it's a reset token (for password reset pages)
    const decoded = authService.decodeToken(token);
    const isResetToken = decoded?.type === "reset";

    // If it's a reset token, check if it has already been used
    if (isResetToken && decoded?.userId) {
      const userWithResetToken = await authService.getUserByEmail(user.email);
      if (
        userWithResetToken &&
        (userWithResetToken as any).lastUsedResetToken === token
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message: "Reset token has already been used",
          });
      }
    }

    return res.json({
      success: true,
      message: "Token is valid",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          isEmailVerified: user.isEmailVerified,
        },
        tokenType: isResetToken ? "reset" : "access",
      },
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

export async function clearExpiredTokens(_req: Request, res: Response) {
  try {
    const result = await authService.clearExpiredTokens();
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res
      .status(500)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function googleLogin(req: Request, res: Response) {
  try {
    const { googleId, email, firstName, lastName } = req.body;
    if (!googleId || !email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "Google ID, email, first name, and last name are required",
      });
    }

    const result = await authService.googleLogin({
      googleId,
      email,
      firstName,
      lastName,
    });

    // For existing users (not new Google users), check email verification
    if (!result.isNewUser && !result.user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email address before logging in. Check your inbox for the verification link.",
        data: {
          requiresVerification: true,
          email: result.user.email,
        },
      });
    }

    return res.json({
      success: true,
      message: result.isNewUser
        ? "User registered successfully with Google"
        : "Login successful",
      data: {
        user: {
          id: result.user._id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          phone: result.user.phone || "",
          isEmailVerified: result.user.isEmailVerified,
          googleId: result.user.googleId,
        },
        accessToken: result.accessToken,
        isNewUser: result.isNewUser,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || "Internal server error",
    });
  }
}

export async function validateResetToken(req: Request, res: Response) {
  try {
    const { token } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Token is required" });
    }

    const result = await authService.validateResetToken(token);

    return res.json({
      success: true,
      data: { isValid: result.isValid },
    });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}

export async function debugPasswordHash(req: Request, res: Response) {
  try {
    const { password } = req.body;
    if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "Password is required" });
    }

    const hash = await authService.debugPasswordHash(password);

    return res.json({
      success: true,
      data: { hash },
    });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, message: e.message || "Internal server error" });
  }
}
