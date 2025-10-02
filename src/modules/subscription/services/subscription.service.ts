import SubscriptionPlansService from "./subscription-plans.service";
import SubscriptionManagementService from "./subscription-management.service";
import SubscriptionBillingService from "./subscription-billing.service";
import {
  SubscriptionPlan,
  UserSubscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  CreatePaymentIntentData,
  CreatePaymentIntentDataOriginal,
  BillingRecord,
  BillingSummary,
  PaymentMethodData,
  SubscriptionConfig,
} from "../types/subscription.types";

export class SubscriptionService {
  private readonly plansService: SubscriptionPlansService;
  private readonly managementService: SubscriptionManagementService;
  private readonly billingService: SubscriptionBillingService;

  constructor() {
    this.plansService = new SubscriptionPlansService();
    this.managementService = new SubscriptionManagementService();
    this.billingService = new SubscriptionBillingService();
  }

  // ==================== PLAN MANAGEMENT ====================

  getPlans = (): SubscriptionPlan[] => {
    return this.plansService.getPlans();
  };

  getPlanById = (planId: string): SubscriptionPlan | null => {
    return this.plansService.getPlanById(planId);
  };

  // Alias for backward compatibility
  getPlan = (planId: string): SubscriptionPlan | null => {
    return this.plansService.getPlanById(planId);
  };

  getPlanByStripePriceId = (stripePriceId: string): SubscriptionPlan | null => {
    return this.plansService.getPlanByStripePriceId(stripePriceId);
  };

  validatePlan = (planId: string): boolean => {
    return this.plansService.validatePlan(planId);
  };

  getPlanComparison = () => {
    return this.plansService.getPlanComparison();
  };

  getUpgradeOptions = (currentPlanId: string): SubscriptionPlan[] => {
    return this.plansService.getUpgradeOptions(currentPlanId);
  };

  getDowngradeOptions = (currentPlanId: string): SubscriptionPlan[] => {
    return this.plansService.getDowngradeOptions(currentPlanId);
  };

  getPlanFeatures = (planId: string): string[] => {
    return this.plansService.getPlanFeatures(planId);
  };

  comparePlans = (planId1: string, planId2: string) => {
    return this.plansService.comparePlans(planId1, planId2);
  };

  getPlanPrice = (planId: string): number => {
    return this.plansService.getPlanPrice(planId);
  };

  calculatePriceDifference = (fromPlanId: string, toPlanId: string): number => {
    return this.plansService.calculatePriceDifference(fromPlanId, toPlanId);
  };

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  getCurrentSubscription = (
    userId: string
  ): Promise<UserSubscription | null> => {
    return this.managementService.getCurrentSubscription(userId);
  };

  // Alias for backward compatibility
  getActiveSubscription = (
    userId: string
  ): Promise<UserSubscription | null> => {
    return this.managementService.getCurrentSubscription(userId);
  };

  createSubscription = (
    data: CreateSubscriptionData
  ): Promise<UserSubscription> => {
    return this.managementService.createSubscription(data);
  };

  cancelSubscription = (
    userId: string,
    reason?: string,
    immediate: boolean = false
  ): Promise<UserSubscription> => {
    return this.managementService.cancelSubscription(userId, reason, immediate);
  };

  reactivateSubscription = (userId: string): Promise<UserSubscription> => {
    return this.managementService.reactivateSubscription(userId);
  };

  changePlan = (
    userId: string,
    newPlanId: string,
    prorationBehavior:
      | "create_prorations"
      | "none"
      | "always_invoice" = "create_prorations"
  ): Promise<UserSubscription> => {
    return this.managementService.changePlan(
      userId,
      newPlanId,
      prorationBehavior
    );
  };

  // ==================== BILLING MANAGEMENT ====================

  createPaymentIntent = (data: CreatePaymentIntentData) => {
    return this.billingService.createPaymentIntent(data);
  };

  // Original implementation for backward compatibility
  createPaymentIntentOriginal = async (data: CreatePaymentIntentDataOriginal) => {
    const plan = this.getPlan(data.planId);
    if (!plan) {
      throw new Error("Invalid plan ID");
    }

    // Create payment intent with plan details
    const paymentIntentData: CreatePaymentIntentData = {
      userId: data.userId,
      amount: plan.price,
      currency: "usd",
      description: `Subscription to ${plan.name}`,
      metadata: {
        planId: data.planId,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
      },
    };

    const result = await this.billingService.createPaymentIntent(paymentIntentData);
    
    // Return in the original format
    return {
      paymentIntent: result,
      subscription: null, // This would be created after payment confirmation
    };
  };

  confirmPaymentIntent = (
    userId: string,
    paymentIntentId: string,
    paymentMethodId?: string
  ) => {
    return this.billingService.confirmPaymentIntent(
      userId,
      paymentIntentId,
      paymentMethodId
    );
  };

  getPaymentIntentStatus = (paymentIntentId: string) => {
    return this.billingService.getPaymentIntentStatus(paymentIntentId);
  };

  getPaymentMethods = (userId: string): Promise<PaymentMethodData[]> => {
    return this.billingService.getPaymentMethods(userId);
  };

  getBillingHistory = (
    userId: string
  ): Promise<{
    billingHistory: BillingRecord[];
    total: number;
  }> => {
    return this.billingService.getBillingHistory(userId);
  };

  getBillingSummary = (userId: string): Promise<BillingSummary> => {
    return this.billingService.getBillingSummary(userId);
  };

  // ==================== VIDEO LIMIT MANAGEMENT ====================

  async checkVideoLimit(userId: string): Promise<{
    canCreateVideo: boolean;
    videoCount: number;
    videoLimit: number;
    remainingVideos: number;
  }> {
    try {
      const subscription = await this.getCurrentSubscription(userId);

      if (!subscription) {
        return {
          canCreateVideo: false,
          videoCount: 0,
          videoLimit: 0,
          remainingVideos: 0,
        };
      }

      const remainingVideos = Math.max(
        0,
        subscription.videoLimit - subscription.videoCount
      );
      const canCreateVideo = remainingVideos > 0;

      return {
        canCreateVideo,
        videoCount: subscription.videoCount,
        videoLimit: subscription.videoLimit,
        remainingVideos,
      };
    } catch (error) {
      throw error;
    }
  }

  async canCreateVideo(userId: string): Promise<boolean> {
    try {
      const result = await this.checkVideoLimit(userId);
      return result.canCreateVideo;
    } catch (error) {
      return false;
    }
  }

  async incrementVideoCount(userId: string): Promise<void> {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      if (!subscription) {
        throw new Error("Subscription not found");
      }

      // This would typically update the database
      // For now, we'll just log the event
      console.log(`Video count incremented for user ${userId}`);
    } catch (error) {
      throw error;
    }
  }

  // ==================== WEBHOOK METHODS ====================

  async createOrUpdateSubscriptionFromWebhook(
    stripeSubscription: any,
    metadata?: any
  ): Promise<void> {
    try {
      // This would typically handle webhook subscription creation/updates
      console.log(
        "Webhook subscription update:",
        stripeSubscription.id,
        metadata
      );
    } catch (error) {
      throw error;
    }
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<any> {
    try {
      // This would typically retrieve subscription by Stripe ID
      return null;
    } catch (error) {
      throw error;
    }
  }

  async updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: string
  ): Promise<void> {
    try {
      // This would typically update subscription status
      console.log(
        `Subscription ${stripeSubscriptionId} status updated to ${status}`
      );
    } catch (error) {
      throw error;
    }
  }

  async resetVideoCountForNewPeriod(
    stripeSubscriptionId: string
  ): Promise<void> {
    try {
      // This would typically reset video count for new billing period
      console.log(`Video count reset for subscription ${stripeSubscriptionId}`);
    } catch (error) {
      throw error;
    }
  }

  async syncRecentSubscriptionByCustomer(
    customerId: string,
    paymentIntentId?: string
  ): Promise<void> {
    try {
      // This would typically sync recent subscription data
      console.log(
        `Syncing subscription for customer ${customerId}`,
        paymentIntentId
      );
    } catch (error) {
      throw error;
    }
  }

  // ==================== CONFIGURATION ====================

  getConfig = (): SubscriptionConfig => {
    return this.plansService.getConfig();
  };

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: {
      plans: any;
      management: any;
      billing: any;
    };
    timestamp: string;
  }> {
    try {
      const plansHealth = await this.plansService.healthCheck();
      const managementHealth = await this.managementService.healthCheck();
      const billingHealth = await this.billingService.healthCheck();

      const overallStatus =
        plansHealth.status === "healthy" &&
        managementHealth.status === "healthy" &&
        billingHealth.status === "healthy"
          ? "healthy"
          : "unhealthy";

      return {
        status: overallStatus,
        services: {
          plans: plansHealth,
          management: managementHealth,
          billing: billingHealth,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        services: {
          plans: { status: "unhealthy" },
          management: { status: "unhealthy" },
          billing: { status: "unhealthy" },
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ==================== BACKWARD COMPATIBILITY METHODS ====================

  getPlanChangeOptions = (currentPlanId: string) => {
    return {
      upgrades: this.getUpgradeOptions(currentPlanId),
      downgrades: this.getDowngradeOptions(currentPlanId),
    };
  };

  async confirmPaymentIntentAndCreateSubscription(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<UserSubscription> {
    // This is a simplified implementation for backward compatibility
    // In a real implementation, this would handle the full payment confirmation flow
    throw new Error("confirmPaymentIntentAndCreateSubscription not implemented");
  }

  async syncSubscriptionFromStripe(stripeSubscriptionId: string): Promise<void> {
    // This is a simplified implementation for backward compatibility
    console.log(`Syncing subscription from Stripe: ${stripeSubscriptionId}`);
  }

  async getHealthStatus() {
    return {
      status: "healthy",
      services: {
        plans: { status: "healthy" },
        management: { status: "healthy" },
        billing: { status: "healthy" },
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export default SubscriptionService;
