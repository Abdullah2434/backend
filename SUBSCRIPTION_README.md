# 🚀 EdgeAI Subscription System

This document explains the subscription system implementation for the EdgeAI backend, including Stripe integration, video limits, and billing management.

## 📋 Overview

The subscription system provides three tiers of service with different video creation limits and pricing:

- **Basic Plan**: $99/month - 1 video per month
- **Growth Plan**: $199/month - 4 videos per month
- **Professional Plan**: $399/month - 12 videos per month

## 🏗️ Architecture

### Models

- **Subscription**: Manages user subscription status, video limits, and Stripe integration
- **Billing**: Tracks payment transactions and invoice history
- **User**: Enhanced with subscription relationship

### Services

- **SubscriptionService**: Core subscription logic, Stripe integration, video limit management
- **VideoService**: Enhanced with subscription limit checks
- **AuthService**: Enhanced with subscription information

### Controllers

- **SubscriptionController**: HTTP endpoints for subscription management
- **StripeWebhookController**: Handles Stripe webhook events

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
npm install stripe
```

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_BASIC_PRICE_ID=price_basic_plan_id
STRIPE_GROWTH_PRICE_ID=price_growth_plan_id
STRIPE_PROFESSIONAL_PRICE_ID=price_professional_plan_id
```

### 3. Stripe Dashboard Setup

1. Create a Stripe account
2. Create three products with recurring prices:
   - Basic Plan: $99/month
   - Growth Plan: $199/month
   - Professional Plan: $399/month
3. Copy the price IDs to your environment variables
4. Set up webhook endpoint: `https://yourdomain.com/api/webhook/stripe`
5. Configure webhook events:
   - `checkout.session.completed` ⭐ **CRITICAL** - Creates subscription records after successful payment
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded` ⭐ **CRITICAL** - Creates subscription records for direct payments
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`

## 📡 API Endpoints

### Subscription Management

```
GET    /api/subscription/plans           - Get all available plans
GET    /api/subscription/current         - Get user's current subscription
POST   /api/subscription/create          - Create new subscription
POST   /api/subscription/cancel          - Cancel subscription
POST   /api/subscription/reactivate      - Reactivate subscription
GET    /api/subscription/payment-methods - Get user's payment methods
GET    /api/subscription/video-limit     - Check video creation limits
POST   /api/subscription/payment-intent  - Create payment intent
```

### Webhooks

```
POST   /api/webhook/stripe               - Stripe webhook handler
```

## 🔐 Video Limit Enforcement

### How It Works

1. **Before Video Creation**: System checks if user has remaining video quota
2. **During Video Creation**: Video count is incremented for the subscription
3. **Monthly Reset**: Video count resets to 0 at the start of each billing period
4. **Limit Exceeded**: Users cannot create new videos until next billing cycle

### Implementation

```typescript
// Check if user can create video
const videoLimit = await subscriptionService.canCreateVideo(userId);
if (!videoLimit.canCreate) {
  throw new Error(
    `Video limit reached. Your plan allows ${videoLimit.limit} videos per month.`
  );
}

// Create video and increment count
const video = await videoService.createVideo(videoData);
await subscriptionService.incrementVideoCount(userId);
```

## 💳 Payment Flow

### 1. Subscription Creation (Fixed Flow)

```
User selects plan → Stripe subscription created → Payment intent returned → User completes payment → Webhook creates local record
```

**Key Changes:**
- ✅ **No premature DB records** - Subscription records are only created after successful payment
- ✅ **Webhook-driven creation** - Records created via `checkout.session.completed` or `invoice.payment_succeeded`
- ✅ **Modal cancellation safe** - If user closes payment modal, no DB record is created

### 2. Monthly Billing

```
Stripe generates invoice → Payment processed → Webhook updates local status → Video count reset
```

### 3. Failed Payments

```
Payment fails → Subscription marked as 'past_due' → User notified → Access restricted
```

## 🔄 Webhook Events

### Subscription Events

- **Created**: New subscription activated
- **Updated**: Status changes, billing period updates
- **Deleted**: Subscription canceled

### Payment Events

- **Succeeded**: Payment processed, billing record updated
- **Failed**: Payment failed, subscription status updated

### Video Count Reset

- **New Billing Period**: Video count automatically resets to 0
- **Automatic**: No manual intervention required

## 📊 Database Schema

### Subscription Collection

```typescript
{
  userId: ObjectId,
  planId: 'basic' | 'growth' | 'professional',
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  status: 'active' | 'canceled' | 'past_due' | 'unpaid',
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean,
  videoCount: number,
  videoLimit: number
}
```

### Billing Collection

```typescript
{
  userId: ObjectId,
  amount: number, // in cents
  currency: string,
  status: 'pending' | 'succeeded' | 'failed' | 'canceled',
  stripeInvoiceId: string,
  stripePaymentIntentId?: string,
  description: string,
  subscriptionId?: ObjectId
}
```

## 🛡️ Security Features

### Input Validation

- Plan ID validation
- Payment method verification
- Stripe webhook signature verification

### Access Control

- Authentication required for all subscription endpoints
- User can only access their own subscription data
- Webhook endpoints protected from unauthorized access

### Data Protection

- Sensitive data (payment methods) not stored locally
- Stripe handles PCI compliance
- Encrypted communication with Stripe

## 🚨 Error Handling

### Common Scenarios

1. **Video Limit Exceeded**: Clear error message with upgrade suggestion
2. **Payment Failed**: Graceful degradation with retry options
3. **Subscription Expired**: Automatic access restriction
4. **Webhook Failures**: Logging and monitoring

### Error Responses

```typescript
{
  success: false,
  message: "Video limit reached. Your plan allows 1 video per month. Please upgrade your subscription to create more videos."
}
```

## 📈 Monitoring & Analytics

### Key Metrics

- Subscription conversion rates
- Video usage patterns
- Payment success rates
- Plan upgrade/downgrade trends

### Logging

- All subscription events logged
- Payment failures tracked
- Webhook processing monitored

## 🔧 Testing

### Test Cards

Use Stripe test cards for development:

- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Insufficient Funds**: 4000 0000 0000 9995

### Webhook Testing

Use Stripe CLI for local webhook testing:

```bash
stripe listen --forward-to localhost:4000/api/webhook/stripe
```

## 🚀 Production Deployment

### Checklist

- [ ] Stripe webhook endpoint configured
- [ ] Environment variables set
- [ ] SSL certificate installed
- [ ] Database indexes created
- [ ] Monitoring configured
- [ ] Backup strategy implemented

### Scaling Considerations

- **Database**: Proper indexing on subscription fields
- **Caching**: Cache subscription status for frequent checks
- **Queue**: Process webhooks asynchronously if needed
- **Monitoring**: Track subscription metrics and alerts

## 📚 Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhook Guide](https://stripe.com/docs/webhooks)
- [Subscription Best Practices](https://stripe.com/docs/billing/subscriptions)
- [Payment Method Management](https://stripe.com/docs/payments/payment-methods)

## 🤝 Support

For issues or questions about the subscription system:

1. Check Stripe dashboard for payment issues
2. Review webhook logs for processing errors
3. Monitor database for subscription inconsistencies
4. Contact development team for technical issues
