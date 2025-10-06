// Re-export all auth middleware functions from the new auth module
// This maintains backward compatibility while using the new modular structure
export {
  requiresAuth,
  isPublicRoute,
  authenticate,
  optionalAuthenticate,
} from "../modules/auth/middleware/auth";
