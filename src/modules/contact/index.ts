// ==================== CONTACT MODULE EXPORTS ====================

// Types
export * from "./types/contact.types";

// Controllers
export {
  submitContactForm,
  getContactStats,
  healthCheck,
} from "./controllers/contact.controller";

// Services
export { default as ContactService } from "./services/contact.service";

// Middleware
export {
  createContactRateLimit,
  contactFormRateLimit,
  contactHealthRateLimit,
  securityHeaders,
  requestSizeLimit,
  requestLogger,
  errorHandler,
  corsOptions,
  sanitizeInput,
  healthCheck as healthCheckMiddleware,
  requestId,
  validateContentType,
} from "./middleware/contact.middleware";

// Validation
export {
  validateContactForm,
  handleValidationErrors,
  validateFullName,
  validatePosition,
  validateEmail,
  validatePhone,
  validateQuestion,
  validateContactFormData,
  sanitizeName,
  sanitizePosition,
  sanitizeEmail,
  sanitizePhone,
  sanitizeQuestion,
} from "./validation/contact.validation";

// Routes
export { default as contactRoutes } from "./routes/contact.routes";

// Utils
export {
  generateSubmissionId,
  generateRequestId,
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidPosition,
  isValidQuestion,
  sanitizeName as sanitizeNameUtil,
  sanitizePosition as sanitizePositionUtil,
  sanitizeEmail as sanitizeEmailUtil,
  sanitizePhone as sanitizePhoneUtil,
  sanitizeQuestion as sanitizeQuestionUtil,
  sanitizeInput as sanitizeInputUtil,
  formatPhone,
  formatName,
  formatQuestion,
  maskEmail,
  maskPhone,
  formatDate,
  formatDateReadable,
  getTimeAgo,
  logContactEvent,
  logContactError,
  logContactSecurity,
  getContactConfig,
  isDevelopment,
  isProduction,
  validateInput,
} from "./utils/contact.utils";

// ==================== MODULE CONFIGURATION ====================

export const contactModuleConfig = {
  name: "contact",
  version: "1.0.0",
  description: "Contact form and communication module",
  routes: {
    prefix: "/api/contact",
    public: ["POST /", "GET /health", "GET /stats"],
    protected: [],
  },
  features: [
    "Contact form submission",
    "Email notifications",
    "Input validation",
    "Rate limiting",
    "Security headers",
    "Request logging",
    "Error handling",
    "Health monitoring",
  ],
  security: {
    rateLimiting: true,
    inputValidation: true,
    securityHeaders: true,
    requestLogging: true,
    errorHandling: true,
    inputSanitization: true,
    contentTypeValidation: true,
  },
};
