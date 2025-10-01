import {
  SubscriptionPlan,
  SubscriptionConfig,
  NotFoundError,
  PlanError,
} from "../types/subscription.types";
import {
  logSubscriptionEvent,
  logSubscriptionError,
  getSubscriptionConfig,
  formatPlanName,
  getPlanComparison,
} from "../utils/subscription.utils";

export class SubscriptionPlansService {
  private readonly config: SubscriptionConfig;
  private readonly plans: SubscriptionPlan[];

  constructor() {
    this.config = getSubscriptionConfig();
    this.plans = this.config.plans;
  }

  // ==================== PLAN MANAGEMENT ====================

  getPlans(): SubscriptionPlan[] {
    try {
      logSubscriptionEvent("plans_retrieved", { count: this.plans.length });
      return this.plans;
    } catch (error) {
      logSubscriptionError(error as Error, { action: "getPlans" });
      throw new PlanError("Failed to retrieve subscription plans");
    }
  }

  getPlanById(planId: string): SubscriptionPlan | null {
    try {
      const plan = this.plans.find((p) => p.id === planId);

      if (!plan) {
        logSubscriptionEvent("plan_not_found", { planId });
        return null;
      }

      logSubscriptionEvent("plan_retrieved", { planId, planName: plan.name });
      return plan;
    } catch (error) {
      logSubscriptionError(error as Error, { planId, action: "getPlanById" });
      throw new PlanError("Failed to retrieve subscription plan");
    }
  }

  getPlanByStripePriceId(stripePriceId: string): SubscriptionPlan | null {
    try {
      const plan = this.plans.find((p) => p.stripePriceId === stripePriceId);

      if (!plan) {
        logSubscriptionEvent("plan_not_found_by_stripe_price", {
          stripePriceId,
        });
        return null;
      }

      logSubscriptionEvent("plan_retrieved_by_stripe_price", {
        stripePriceId,
        planId: plan.id,
        planName: plan.name,
      });
      return plan;
    } catch (error) {
      logSubscriptionError(error as Error, {
        stripePriceId,
        action: "getPlanByStripePriceId",
      });
      throw new PlanError(
        "Failed to retrieve subscription plan by Stripe price ID"
      );
    }
  }

  validatePlan(planId: string): boolean {
    try {
      const plan = this.getPlanById(planId);
      const isValid = plan !== null;

      logSubscriptionEvent("plan_validated", { planId, isValid });
      return isValid;
    } catch (error) {
      logSubscriptionError(error as Error, { planId, action: "validatePlan" });
      return false;
    }
  }

  // ==================== PLAN COMPARISON ====================

  getPlanComparison(): any[] {
    try {
      const comparison = getPlanComparison(this.plans);
      logSubscriptionEvent("plan_comparison_retrieved", {
        planCount: comparison.length,
      });
      return comparison;
    } catch (error) {
      logSubscriptionError(error as Error, { action: "getPlanComparison" });
      throw new PlanError("Failed to retrieve plan comparison");
    }
  }

  getUpgradeOptions(currentPlanId: string): SubscriptionPlan[] {
    try {
      const currentPlan = this.getPlanById(currentPlanId);
      if (!currentPlan) {
        throw new NotFoundError("Current plan not found");
      }

      const upgradeOptions = this.plans.filter(
        (plan) => plan.price > currentPlan.price
      );

      logSubscriptionEvent("upgrade_options_retrieved", {
        currentPlanId,
        upgradeCount: upgradeOptions.length,
      });
      return upgradeOptions;
    } catch (error) {
      logSubscriptionError(error as Error, {
        currentPlanId,
        action: "getUpgradeOptions",
      });
      throw new PlanError("Failed to retrieve upgrade options");
    }
  }

  getDowngradeOptions(currentPlanId: string): SubscriptionPlan[] {
    try {
      const currentPlan = this.getPlanById(currentPlanId);
      if (!currentPlan) {
        throw new NotFoundError("Current plan not found");
      }

      const downgradeOptions = this.plans.filter(
        (plan) => plan.price < currentPlan.price
      );

      logSubscriptionEvent("downgrade_options_retrieved", {
        currentPlanId,
        downgradeCount: downgradeOptions.length,
      });
      return downgradeOptions;
    } catch (error) {
      logSubscriptionError(error as Error, {
        currentPlanId,
        action: "getDowngradeOptions",
      });
      throw new PlanError("Failed to retrieve downgrade options");
    }
  }

  // ==================== PLAN FEATURES ====================

  getPlanFeatures(planId: string): string[] {
    try {
      const plan = this.getPlanById(planId);
      if (!plan) {
        throw new NotFoundError("Plan not found");
      }

      logSubscriptionEvent("plan_features_retrieved", {
        planId,
        featureCount: plan.features.length,
      });
      return plan.features;
    } catch (error) {
      logSubscriptionError(error as Error, {
        planId,
        action: "getPlanFeatures",
      });
      throw new PlanError("Failed to retrieve plan features");
    }
  }

  comparePlans(
    planId1: string,
    planId2: string
  ): {
    plan1: SubscriptionPlan;
    plan2: SubscriptionPlan;
    differences: {
      price: number;
      videoLimit: number;
      features: {
        added: string[];
        removed: string[];
        common: string[];
      };
    };
  } {
    try {
      const plan1 = this.getPlanById(planId1);
      const plan2 = this.getPlanById(planId2);

      if (!plan1 || !plan2) {
        throw new NotFoundError("One or both plans not found");
      }

      const differences = {
        price: plan2.price - plan1.price,
        videoLimit: plan2.videoLimit - plan1.videoLimit,
        features: {
          added: plan2.features.filter((f) => !plan1.features.includes(f)),
          removed: plan1.features.filter((f) => !plan2.features.includes(f)),
          common: plan1.features.filter((f) => plan2.features.includes(f)),
        },
      };

      logSubscriptionEvent("plans_compared", {
        planId1,
        planId2,
        priceDifference: differences.price,
      });

      return {
        plan1,
        plan2,
        differences,
      };
    } catch (error) {
      logSubscriptionError(error as Error, {
        planId1,
        planId2,
        action: "comparePlans",
      });
      throw new PlanError("Failed to compare plans");
    }
  }

  // ==================== PLAN PRICING ====================

  getPlanPrice(planId: string): number {
    try {
      const plan = this.getPlanById(planId);
      if (!plan) {
        throw new NotFoundError("Plan not found");
      }

      logSubscriptionEvent("plan_price_retrieved", {
        planId,
        price: plan.price,
      });
      return plan.price;
    } catch (error) {
      logSubscriptionError(error as Error, { planId, action: "getPlanPrice" });
      throw new PlanError("Failed to retrieve plan price");
    }
  }

  calculatePriceDifference(fromPlanId: string, toPlanId: string): number {
    try {
      const fromPlan = this.getPlanById(fromPlanId);
      const toPlan = this.getPlanById(toPlanId);

      if (!fromPlan || !toPlan) {
        throw new NotFoundError("One or both plans not found");
      }

      const difference = toPlan.price - fromPlan.price;

      logSubscriptionEvent("price_difference_calculated", {
        fromPlanId,
        toPlanId,
        difference,
      });
      return difference;
    } catch (error) {
      logSubscriptionError(error as Error, {
        fromPlanId,
        toPlanId,
        action: "calculatePriceDifference",
      });
      throw new PlanError("Failed to calculate price difference");
    }
  }

  // ==================== CONFIGURATION ====================

  getConfig(): SubscriptionConfig {
    return { ...this.config };
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    plans: {
      total: number;
      available: number;
    };
    timestamp: string;
  }> {
    try {
      const totalPlans = this.plans.length;
      const availablePlans = this.plans.filter(
        (plan) => plan.stripePriceId && plan.stripePriceId !== ""
      ).length;

      return {
        status: "healthy",
        plans: {
          total: totalPlans,
          available: availablePlans,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        plans: {
          total: 0,
          available: 0,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default SubscriptionPlansService;
