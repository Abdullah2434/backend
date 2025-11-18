/**
 * Types for syncSubscriptions cron job
 */

import mongoose from "mongoose";
import { ISubscription } from "../../models/Subscription";

export interface SubscriptionSyncResult {
  synced: boolean;
  updated: boolean;
  error: boolean;
  subscriptionId?: string;
  errorMessage?: string;
}

export interface SyncSubscriptionsSummary {
  totalSubscriptions: number;
  syncedCount: number;
  updatedCount: number;
  errorCount: number;
  errors: string[];
}

export interface SyncSubscriptionsConfig {
  maxRetries: number;
  retryInitialDelayMs: number;
  overallTimeoutMs: number;
  databaseTimeoutMs: number;
  apiTimeoutMs: number;
  batchSize: number;
  delayBetweenBatchesMs: number;
}

export interface ActiveSubscription {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: "active" | "pending" | "incomplete" | "past_due" | "canceled" | "unpaid";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "pending"
  | "incomplete";

