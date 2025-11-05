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
    console.log("🔄 Starting subscription sync from Stripe...");

    // Find all active or pending subscriptions in the database
    const activeSubscriptions = await Subscription.find({
      status: { $in: ["active", "pending", "incomplete", "past_due"] },
    }).select("stripeSubscriptionId status userId");

    console.log(
      `📊 Found ${activeSubscriptions.length} subscriptions to sync`
    );

    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const localSub of activeSubscriptions) {
      try {
        if (!localSub.stripeSubscriptionId) {
          console.log(
            `⚠️ Subscription ${localSub._id} has no Stripe subscription ID, skipping`
          );
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
          console.log(
            `✅ Subscription ${localSub.stripeSubscriptionId} status updated: ${localSub.status} → ${syncedSubscription.status}`
          );
        } else {
          syncedCount++;
        }
      } catch (error: any) {
        errorCount++;
        console.error(
          `❌ Error syncing subscription ${localSub.stripeSubscriptionId}:`,
          error.message
        );
      }
    }

    console.log(
      `✅ Subscription sync completed: ${syncedCount} synced, ${updatedCount} updated, ${errorCount} errors`
    );
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
    console.log(`⏰ Subscription sync cron job started at ${new Date().toISOString()}`);
    await syncAllActiveSubscriptions();
  });

  // Also run immediately on startup (optional - for testing)
  // Uncomment if you want to sync on server start
  // syncAllActiveSubscriptions();

  console.log("⏰ Subscription sync cron job started - running every hour");
}

