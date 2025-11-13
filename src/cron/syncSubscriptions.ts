import cron from "node-cron";
import { SubscriptionService } from "../services/subscription.service";
import Subscription from "../models/Subscription";

const subscriptionService = new SubscriptionService();

/**
 * Sync all active subscriptions from Stripe
 * This handles recurring payments automatically processed by Stripe
 */
async function syncAllActiveSubscriptions() {
  try {
  
    const activeSubscriptions = await Subscription.find({
      status: { $in: ["active", "pending", "incomplete", "past_due"] },
    }).select("stripeSubscriptionId status userId");

    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const localSub of activeSubscriptions) {
      try {
        if (!localSub.stripeSubscriptionId) {
       
          continue;
        }

        // Sync subscription from Stripe
        const syncedSubscription = await subscriptionService.syncSubscriptionFromStripe(
          localSub.stripeSubscriptionId,
          localSub.userId.toString()
        );

        // Check if status changed
        if (syncedSubscription.status !== localSub.status) {
          updatedCount++;
     
        } else {
          syncedCount++;
        }
      } catch (error: any) {
        errorCount++;
     
      }
    }
  } catch (error: any) {
    console.error("❌ Error in subscription sync cron job:", error);
  }
}

/**
 * Start subscription sync cron job
 * Runs every hour to check for recurring payments and subscription updates
 */
export function startSubscriptionSync() {
  // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
  cron.schedule("0 * * * *", async () => {
    await syncAllActiveSubscriptions();
  });

}

