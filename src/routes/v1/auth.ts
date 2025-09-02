import { Router } from 'express'
import * as ctrl from '../../controllers/auth.controller'
import { 
  loginRateLimiter, 
  registerRateLimiter, 
  passwordResetRateLimiter,
  generateCSRFToken,
  authenticate
} from '../../middleware'

const router = Router()

// PUBLIC ROUTES (no authentication required)
router.post('/register', registerRateLimiter.middleware(), ctrl.register)
router.post('/login', loginRateLimiter.middleware(), ctrl.login)
router.post('/forgot-password', passwordResetRateLimiter.middleware(), ctrl.forgotPassword)
router.post('/reset-password', passwordResetRateLimiter.middleware(), ctrl.resetPassword)
router.post('/validate-reset-token', ctrl.validateResetToken)
router.post('/debug-password-hash', ctrl.debugPasswordHash)
router.get('/verify-email', ctrl.verifyEmail)
router.post('/resend-verification', ctrl.resendVerification)
router.get('/check-email', ctrl.checkEmail)
router.post('/check-email-verification', ctrl.checkEmailVerification)
router.post('/validate-token', ctrl.validateToken)
router.post('/google', ctrl.googleLogin)

// PROTECTED ROUTES (authentication required)
router.get('/me', authenticate(), ctrl.me)
router.put('/profile', authenticate(), ctrl.updateProfile)
router.post('/logout', authenticate(), ctrl.logout)
router.post('/clear-expired-tokens', authenticate(), ctrl.clearExpiredTokens)

// CSRF token endpoint
router.get('/csrf-token', async (req, res) => {
  try {
    const result = await generateCSRFToken()
    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate CSRF token'
    })
  }
})

export default router


