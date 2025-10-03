// Re-export AuthService from the new auth module
// This maintains backward compatibility while using the new modular structure
export { AuthService as default } from "../modules/auth/services/auth.service";
