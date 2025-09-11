import { Router } from 'express'
import * as ctrl from '../../controllers/auth.controller'
import { 
  loginRateLimiter, 
  registerRateLimiter, 
  passwordResetRateLimiter,
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
router.get('/me', ctrl.me)
router.put('/profile', ctrl.updateProfile)
router.post('/logout', ctrl.logout)
router.post('/clear-expired-tokens', ctrl.clearExpiredTokens)

export default router


