// Re-export all auth controller functions from the new auth module
// This maintains backward compatibility while using the new modular structure
export {
  register,
  login,
  me,
  updateProfile,
  logout,
  forgotPassword,
  resetPassword,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  verifyEmail,
  verifyOtp,
  resendVerification,
  checkEmail,
  checkEmailVerification,
  validateToken,
  clearExpiredTokens,
  googleLogin,
  validateResetToken,
  debugPasswordHash,
} from "../modules/auth/controllers/auth.controller";
