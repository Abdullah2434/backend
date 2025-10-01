import * as crypto from "crypto";

// ==================== SUBSCRIPTION UTILITIES ====================

export const generateSubscriptionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `sub_${timestamp}_${random}`;
};

export const generateBillingId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `bill_${timestamp}_${random}`;
};

export const generateInvoiceId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString("hex");
  return `inv_${timestamp}_${random}`;
};

// ==================== VALIDATION UTILITIES ====================

export const isValidPlanId = (planId: string): boolean => {
  if (!planId || typeof planId !== "string") return false;
  const trimmed = planId.trim();
  if (trimmed.length < 1 || trimmed.length > 50) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

export const isValidSubscriptionId = (subscriptionId: string): boolean => {
  if (!subscriptionId || typeof subscriptionId !== "string") return false;
  const trimmed = subscriptionId.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^sub_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const isValidPaymentIntentId = (paymentIntentId: string): boolean => {
  if (!paymentIntentId || typeof paymentIntentId !== "string") return false;
  const trimmed = paymentIntentId.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^pi_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const isValidCustomerId = (customerId: string): boolean => {
  if (!customerId || typeof customerId !== "string") return false;
  const trimmed = customerId.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return false;
  return /^cus_[a-zA-Z0-9_]+$/.test(trimmed);
};

export const isValidAmount = (amount: number): boolean => {
  if (typeof amount !== "number" || isNaN(amount)) return false;
  if (amount < 50 || amount > 1000000) return false;
  return amount % 50 === 0;
};

export const isValidCurrency = (currency: string): boolean => {
  if (!currency || typeof currency !== "string") return false;
  const trimmed = currency.trim();
  if (trimmed.length !== 3) return false;
  return /^[A-Z]{3}$/.test(trimmed);
};

export const isValidCouponCode = (couponCode: string): boolean => {
  if (!couponCode || typeof couponCode !== "string") return false;
  const trimmed = couponCode.trim();
  if (trimmed.length < 1 || trimmed.length > 50) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

// ==================== SANITIZATION UTILITIES ====================

export const sanitizeString = (str: string): string => {
  return str
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /[^\w\s\?\!\.\,\;\:\-\(\)\[\]\{\}\"\'\/\\\@\#\$\%\^\&\*\+\=\<\>\|`~]/g,
      ""
    );
};

export const sanitizeInput = (input: any): any => {
  if (typeof input === "string") {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim();
  } else if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  } else if (input && typeof input === "object") {
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
};

// ==================== FORMATTING UTILITIES ====================

export const formatAmount = (
  amount: number,
  currency: string = "usd"
): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const formatDateReadable = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
};

export const formatSubscriptionStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    active: "Active",
    canceled: "Canceled",
    past_due: "Past Due",
    unpaid: "Unpaid",
    incomplete: "Incomplete",
    trialing: "Trial",
  };
  return statusMap[status] || status;
};

export const formatPlanName = (planName: string): string => {
  return planName.charAt(0).toUpperCase() + planName.slice(1).toLowerCase();
};

// ==================== MASKING UTILITIES ====================

export const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) return email;
  const maskedLocal =
    localPart[0] +
    "*".repeat(localPart.length - 2) +
    localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
};

export const maskSubscriptionId = (subscriptionId: string): string => {
  if (subscriptionId.length <= 8) return subscriptionId;
  return (
    subscriptionId.slice(0, 4) +
    "*".repeat(subscriptionId.length - 8) +
    subscriptionId.slice(-4)
  );
};

export const maskPaymentIntentId = (paymentIntentId: string): string => {
  if (paymentIntentId.length <= 8) return paymentIntentId;
  return (
    paymentIntentId.slice(0, 4) +
    "*".repeat(paymentIntentId.length - 8) +
    paymentIntentId.slice(-4)
  );
};

// ==================== LOGGING UTILITIES ====================

export const logSubscriptionEvent = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeInput(data),
  };
  console.log("💳 Subscription Event:", JSON.stringify(logData, null, 2));
};

export const logSubscriptionError = (error: Error, context?: any): void => {
  const logData = {
    error: error.message,
    stack: error.stack,
    context: sanitizeInput(context),
    timestamp: new Date().toISOString(),
  };
  console.error("💳 Subscription Error:", JSON.stringify(logData, null, 2));
};

export const logSubscriptionSecurity = (event: string, data: any): void => {
  const logData = {
    event,
    timestamp: new Date().toISOString(),
    data: sanitizeInput(data),
    severity: "security",
  };
  console.warn("🔒 Subscription Security:", JSON.stringify(logData, null, 2));
};

// ==================== CONFIGURATION UTILITIES ====================

export const getSubscriptionConfig = () => {
  return {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    apiVersion: "2023-10-16",
    currency: "usd",
    trialDays: parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || "7"),
    gracePeriodDays: parseInt(
      process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || "3"
    ),
    rateLimitWindow: parseInt(
      process.env.SUBSCRIPTION_RATE_LIMIT_WINDOW || "900000"
    ), // 15 minutes
    rateLimitMax: parseInt(process.env.SUBSCRIPTION_RATE_LIMIT_MAX || "10"),
    plans: [
      {
        id: "basic",
        name: "Basic Plan",
        price: 9900, // $99.00 in cents
        videoLimit: 1,
        stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || "price_basic",
        features: ["1 video per month", "Basic support", "Standard processing"],
      },
      {
        id: "growth",
        name: "Growth Plan",
        price: 19900, // $199.00 in cents
        videoLimit: 4,
        stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID || "price_growth",
        features: [
          "4 videos per month",
          "Priority support",
          "Faster processing",
        ],
      },
      {
        id: "enterprise",
        name: "Enterprise Plan",
        price: 49900, // $499.00 in cents
        videoLimit: 10,
        stripePriceId:
          process.env.STRIPE_ENTERPRISE_PRICE_ID || "price_enterprise",
        features: [
          "10 videos per month",
          "Premium support",
          "Fastest processing",
          "Custom integrations",
        ],
      },
    ],
  };
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === "development";
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === "production";
};

// ==================== VALIDATION UTILITIES ====================

export const validateInput = (
  input: any,
  rules: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = input[field];
    const fieldRule = rule as any;

    if (fieldRule.required && (!value || value.toString().trim() === "")) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value && fieldRule.minLength && value.length < fieldRule.minLength) {
      errors.push(
        `${field} must be at least ${fieldRule.minLength} characters`
      );
    }

    if (value && fieldRule.maxLength && value.length > fieldRule.maxLength) {
      errors.push(
        `${field} must be less than ${fieldRule.maxLength} characters`
      );
    }

    if (value && fieldRule.pattern && !fieldRule.pattern.test(value)) {
      errors.push(`${field} format is invalid`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ==================== SUBSCRIPTION SPECIFIC UTILITIES ====================

export const calculateProration = (
  currentPlanPrice: number,
  newPlanPrice: number,
  daysRemaining: number,
  totalDays: number
): number => {
  const dailyRate = (newPlanPrice - currentPlanPrice) / totalDays;
  return Math.round(dailyRate * daysRemaining);
};

export const calculateTrialEndDate = (trialDays: number): Date => {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  return trialEnd;
};

export const isTrialActive = (trialEnd: Date): boolean => {
  return new Date() < trialEnd;
};

export const isSubscriptionActive = (status: string): boolean => {
  return ["active", "trialing"].includes(status);
};

export const isSubscriptionCanceled = (status: string): boolean => {
  return ["canceled", "past_due", "unpaid"].includes(status);
};

export const getDaysUntilRenewal = (currentPeriodEnd: Date): number => {
  const now = new Date();
  const diffTime = currentPeriodEnd.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getDaysUntilTrialEnd = (trialEnd: Date): number => {
  const now = new Date();
  const diffTime = trialEnd.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const calculateSubscriptionHash = async (
  subscriptionData: any
): Promise<string> => {
  const subscriptionString = JSON.stringify(subscriptionData);
  return crypto.createHash("sha256").update(subscriptionString).digest("hex");
};

export const generateSubscriptionMetadata = (subscriptionData: any): any => {
  return {
    userId: subscriptionData.userId,
    planId: subscriptionData.planId,
    timestamp: new Date().toISOString(),
    source: "web",
    version: "1.0.0",
  };
};

export const formatSubscriptionFeatures = (features: string[]): string => {
  return features.map((feature) => `• ${feature}`).join("\n");
};

export const getPlanComparison = (plans: any[]): any => {
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    videoLimit: plan.videoLimit,
    features: plan.features,
    isPopular: plan.id === "growth", // Mark growth plan as popular
    savings: plan.id === "enterprise" ? "Save 17%" : null,
  }));
};

export const calculateChurnRate = (
  canceledSubscriptions: number,
  totalSubscriptions: number
): number => {
  if (totalSubscriptions === 0) return 0;
  return (canceledSubscriptions / totalSubscriptions) * 100;
};

export const calculateMRR = (subscriptions: any[]): number => {
  return subscriptions.reduce((total, sub) => {
    if (isSubscriptionActive(sub.status)) {
      return total + sub.planPrice;
    }
    return total;
  }, 0);
};

export const calculateARPU = (
  totalRevenue: number,
  activeSubscriptions: number
): number => {
  if (activeSubscriptions === 0) return 0;
  return totalRevenue / activeSubscriptions;
};
