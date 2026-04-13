# API Documentation

## Payment Routes

| METHOD | ROUTE | RESPONSE BODY | DESCRIPTION |
|--------|-------|---------------|-------------|
| POST | `/payments/create-checkout-session` | `{"checkout_url": "string", "session_id": "string"}` | Create Stripe checkout session for subscription |
| POST | `/payments/create-subscription` | `{"subscription_id": "string", "status": "string", "client_secret": "string"}` | Create new subscription for user |
| GET | `/payments/subscription-status/{user_id}` | `{"status": "string", "subscription": {...}}` | Get user's subscription status |
| POST | `/payments/cancel-subscription/{user_id}` | `{"message": "string"}` | Cancel subscription at period end |
| POST | `/payments/webhook` | `{"received": true}` | Handle Stripe webhooks |
| GET | `/payments/history/{user_id}` | `{"payments": [...]}` | Get user's payment history |

## Admin Routes

| METHOD | ROUTE | RESPONSE BODY | DESCRIPTION |
|--------|-------|---------------|-------------|
| GET | `/admin/users` | `{"users": [...]}` | Get all users (paginated) |
| GET | `/admin/users/{user_id}` | `{"user": {...}, "settings": {...}, "subscription": {...}, "payments": [...]}` | Get user details |
| PATCH | `/admin/users/{user_id}` | `{"user": {...}` | Update user role or admin status |
| DELETE | `/admin/users/{user_id}` | `{"message": "string"}` | Delete user |
| GET | `/admin/payments` | `{"payments": [...]}` | Get all payments |
| GET | `/admin/subscriptions` | `{"subscriptions": [...]}` | Get all subscriptions |
| GET | `/admin/stats` | `{"total_users": int, "total_payments": int, "total_revenue": int, "active_subscriptions": int, ...}` | Dashboard statistics |

## Request Models

### CreateCheckoutRequest
```json
{
  "price_id": "string",
  "user_id": 1
}
```

### CreateSubscriptionRequest
```json
{
  "user_id": 1,
  "price_id": "monthly" | "yearly"
}
```

### UserUpdate
```json
{
  "is_admin": true,
  "role": "student" | "teacher" | "admin"
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret (whsec_...) |
| `STRIPE_MONTHLY_PRICE_ID` | Monthly subscription price ID |
| `STRIPE_YEARLY_PRICE_ID` | Yearly subscription price ID |

## Authentication

Admin routes require `Authorization: Bearer <token>` header.

Make sure at least one user has `is_admin = TRUE` in the database.