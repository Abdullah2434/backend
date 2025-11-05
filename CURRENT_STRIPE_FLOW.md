# 🔄 Current Stripe Subscription Flow

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 1: CREATE PAYMENT INTENT                │
└─────────────────────────────────────────────────────────────────┘
Frontend → POST /api/subscription/payment-intent
           Body: { planId: "monthly" }
           ↓
Backend → • Validates user & plan
           • Creates Stripe customer (if needed)
           • Creates Stripe subscription (status: incomplete)
           • Gets payment intent from invoice
           • Adds metadata to payment intent:
             - subscriptionId: "sub_xxx"
             - userId: "xxx"
             - planId: "monthly"
           • If payment already succeeded → Auto-syncs ✅
           ↓
Returns → { paymentIntent, subscription, plan }
           paymentIntent.status: "requires_payment_method"
           subscription.status: "pending"
           ↓
Database → ❌ NO subscription record yet (only Stripe exists)


┌─────────────────────────────────────────────────────────────────┐
│                    STEP 2: CONFIRM PAYMENT                      │
└─────────────────────────────────────────────────────────────────┘
Frontend → stripe.confirmCardPayment(clientSecret, { payment_method })
           ↓
Stripe → Processes payment
           ↓
Returns → paymentIntent.status: "succeeded" ✅
           paymentIntent.id: "pi_xxx"


┌─────────────────────────────────────────────────────────────────┐
│              STEP 3: AUTO-SYNC (AUTOMATIC)                      │
└─────────────────────────────────────────────────────────────────┘
Option A: Auto-Sync Endpoint (RECOMMENDED)
Frontend → POST /api/subscription/auto-sync-on-success
           Body: { paymentIntentId: "pi_xxx" }
           ↓
Backend → • Checks payment intent status = "succeeded"
           • Finds subscription from payment intent metadata
           • Syncs subscription from Stripe
           • Creates/updates subscription in database
           ↓
Returns → { paymentIntent, subscription }

Option B: Manual Sync Endpoint
Frontend → POST /api/subscription/sync-from-stripe
           Body: { paymentIntentId: "pi_xxx" } OR { stripeSubscriptionId: "sub_xxx" }
           ↓
Backend → Same as Option A
           ↓
Returns → { subscription }

Option C: Get Status with Auto-Sync
Frontend → GET /api/subscription/payment-intent/:id/status?autoSync=true
           ↓
Backend → If status = "succeeded" → Auto-syncs
           ↓
Returns → { paymentIntent, subscription, autoSynced: true }


┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: RECURRING PAYMENTS (CRON)                  │
└─────────────────────────────────────────────────────────────────┘
Cron Job → Runs every hour (0 * * * *)
           ↓
Process → • Finds all active/pending subscriptions
           • For each: syncs from Stripe
           • Updates status, billing periods, etc.
           ↓
Result → Database stays in sync with Stripe
           Recurring payments reflected automatically


┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE STATE CHANGES                        │
└─────────────────────────────────────────────────────────────────┘
Before Payment:
  Database: ❌ No subscription record
  Stripe: ✅ Subscription exists (incomplete)
  Payment: ✅ Payment intent exists (requires_payment_method)

After Payment (Before Sync):
  Database: ❌ No subscription record
  Stripe: ✅ Subscription exists (active)
  Payment: ✅ Payment intent exists (succeeded)

After Sync:
  Database: ✅ Subscription record exists (active) ← CREATED HERE
  Stripe: ✅ Subscription exists (active)
  Payment: ✅ Payment intent exists (succeeded)

After Recurring Payment:
  Cron Job: ✅ Syncs automatically within 1 hour
  Database: ✅ Updated with new billing period
```

---

## 🎯 Key Features

### **1. Automatic Sync on Payment Success**

- If payment intent status is already `succeeded` when creating, it auto-syncs
- Dedicated `/auto-sync-on-success` endpoint for automatic syncing
- `getPaymentIntentStatus` can auto-sync with `?autoSync=true` parameter

### **2. Manual Sync Options**

- `/sync-from-stripe` accepts either `paymentIntentId` or `stripeSubscriptionId`
- Automatically detects which type of ID is provided
- Creates subscription if doesn't exist, updates if exists

### **3. Automatic Recurring Payment Handling**

- Cron job runs **every hour** to sync all active subscriptions
- Automatically updates billing periods when Stripe processes recurring payments
- No manual intervention needed

### **4. No Webhooks Required**

- All webhook functionality removed
- Uses manual sync + cron job instead
- More reliable and easier to debug

---

## 📋 API Endpoints

### **1. Create Payment Intent**

```
POST /api/subscription/payment-intent
Auth: Required
Body: { planId: "monthly" }
Returns: { paymentIntent, subscription, plan }

Note: If payment already succeeded, auto-syncs automatically
```

### **2. Auto-Sync on Payment Success** ⭐ NEW

```
POST /api/subscription/auto-sync-on-success
Auth: Required
Body: { paymentIntentId: "pi_xxx" }
Returns: { paymentIntent, subscription }

Automatically syncs if payment status = "succeeded"
```

### **3. Manual Sync**

```
POST /api/subscription/sync-from-stripe
Auth: Required
Body: { paymentIntentId: "pi_xxx" } OR { stripeSubscriptionId: "sub_xxx" }
Returns: { subscription }

Creates or updates subscription
```

### **4. Get Payment Intent Status (with optional auto-sync)**

```
GET /api/subscription/payment-intent/:id/status?autoSync=true
Auth: Required
Returns: { paymentIntent, subscription?, autoSynced: boolean }

If autoSync=true and status=succeeded, automatically syncs
```

---

## 💻 Frontend Flow

### **Simplified Flow (Recommended)**

```javascript
// 1. Create payment intent
const { paymentIntent } = await createPaymentIntent("monthly");

// 2. Confirm payment on frontend
const { paymentIntent: confirmed } = await stripe.confirmCardPayment(
  paymentIntent.client_secret,
  { payment_method: { card } }
);

// 3. Auto-sync when payment succeeds
if (confirmed.status === "succeeded") {
  const response = await fetch("/api/subscription/auto-sync-on-success", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      paymentIntentId: confirmed.id,
    }),
  });

  const { subscription } = await response.json();
  console.log("Subscription active!", subscription);
}
```

### **Alternative: Check Status with Auto-Sync**

```javascript
// After payment confirmation
const response = await fetch(
  `/api/subscription/payment-intent/${paymentIntentId}/status?autoSync=true`,
  {
    headers: { Authorization: `Bearer ${token}` },
  }
);

const { paymentIntent, subscription, autoSynced } = await response.json();

if (autoSynced && subscription) {
  console.log("Subscription auto-synced!", subscription);
}
```

---

## 🔄 Automatic Features

### **1. Auto-Sync in createPaymentIntent**

- If payment intent status is already `succeeded` when creating
- Automatically syncs subscription before returning
- No additional API call needed

### **2. Auto-Sync in confirmPaymentIntent**

- When confirming payment intent via backend
- Automatically syncs subscription after confirmation

### **3. Hourly Cron Job**

- Runs every hour at minute 0
- Syncs all active/pending subscriptions
- Handles recurring payments automatically

---

## 📝 Summary

**Current Flow:**

1. ✅ Create payment intent → Returns payment intent + subscription info
2. ✅ Confirm payment on frontend → Payment intent status becomes `succeeded`
3. ✅ Auto-sync subscription → Call `/auto-sync-on-success` or use `?autoSync=true`
4. ✅ Recurring payments → Cron job syncs every hour automatically

**Key Points:**

- No webhooks required
- Manual sync is primary method
- Auto-sync available via dedicated endpoint
- Cron job handles recurring payments
- Database stays in sync automatically

---

## 🎯 Best Practice

**Recommended Frontend Flow:**

```javascript
// After payment succeeds
await fetch("/api/subscription/auto-sync-on-success", {
  method: "POST",
  body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
});
```

This ensures:

- ✅ Payment is verified (`succeeded` status)
- ✅ Subscription is automatically synced
- ✅ Database is updated immediately
- ✅ User gets active subscription right away
