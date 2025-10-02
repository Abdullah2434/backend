import Stripe from "stripe";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in cents
  videoLimit: number;
  stripePriceId: string;
  features: string[];
}

export interface UserSubscription {
  _id?: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: "active" | "canceled" | "past_due" | "incomplete" | "trialing";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  videosUsed: number;
  videoLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionData {
  userId: string;
  planId: string;
  paymentMethodId: string;
}

export interface UpdateSubscriptionData {
  subscriptionId: string;
  planId?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface CreatePaymentIntentData {
  userId: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface PaymentMethodData {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

export interface BillingHistory {
  _id?: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  invoiceId: string;
  stripeInvoiceId: string;
  periodStart: Date;
  periodEnd: Date;
  paidAt?: Date;
  createdAt: Date;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

export interface SubscriptionUsage {
  videosUsed: number;
  videoLimit: number;
  remaining: number;
  percentageUsed: number;
}

export interface SubscriptionSummary {
  subscription: UserSubscription | null;
  plan: SubscriptionPlan | null;
  usage: SubscriptionUsage | null;
  billingHistory: BillingHistory[];
  paymentMethods: PaymentMethodData[];
}
