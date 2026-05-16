from fastapi import APIRouter, Request, HTTPException, Depends
from loguru import logger
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import sys
import stripe
import os

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=False)

from core.config import BASE_URL, DSN
from db.db_functions import Users_DB
from api.deps import get_current_user

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

users = Users_DB(DSN)

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)

PRICE_IDS = {
    "monthly": os.getenv("STRIPE_MONTHLY_PRICE_ID"),
    "yearly": os.getenv("STRIPE_YEARLY_PRICE_ID"),
}


class CreateCheckoutRequest(BaseModel):
    price_id: str


class CreateSubscriptionRequest(BaseModel):
    price_id: str


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        user_id = current_user["id"]
        await users.initialize()

        subscription = await users.get_subscription(user_id)
        customer_id = subscription["stripe_customer_id"] if subscription else None

        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.get("email"),
                metadata={"user_id": str(user_id)},
            )
            customer_id = customer.id

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": request.price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{BASE_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{BASE_URL}/payment/cancel",
            metadata={
                "user_id": str(user_id),
                "price_id": request.price_id,
            },
        )

        await users.close()
        return {"checkout_url": session.url, "session_id": session.id}

    except Exception as ex:
        logger.error(ex)
        await users.close()
        raise HTTPException(status_code=500, detail=str(ex))


@router.post("/create-subscription")
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        user_id = current_user["id"]
        price_id = PRICE_IDS.get(request.price_id)
        if not price_id:
            raise HTTPException(status_code=400, detail="Invalid price_id")

        await users.initialize()
        subscription = await users.get_subscription(user_id)
        customer_id = subscription["stripe_customer_id"] if subscription else None

        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.get("email"),
                metadata={"user_id": str(user_id)},
            )
            customer_id = customer.id

        stripe_sub = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"],
        )

        await users.upsert_subscription(
            user_id=user_id,
            stripe_customer_id=customer_id,
            stripe_subscription_id=stripe_sub.id,
            stripe_price_id=price_id,
            status=stripe_sub.status,
            current_period_start=stripe_sub.current_period_start,
            current_period_end=stripe_sub.current_period_end,
        )

        await users.close()

        return {
            "subscription_id": stripe_sub.id,
            "status": stripe_sub.status,
            "client_secret": stripe_sub.latest_invoice.payment_intent.client_secret
            if stripe_sub.latest_invoice
            else None,
        }

    except HTTPException:
        raise
    except Exception as ex:
        logger.error(ex)
        await users.close()
        raise HTTPException(status_code=500, detail=str(ex))


@router.get("/subscription-status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["id"]
        await users.initialize()
        subscription = await users.get_subscription(user_id)
        has_promo = await users.has_full_access(user_id)
        await users.close()

        if not subscription:
            return {
                "status": "inactive",
                "hasFullAccess": has_promo,
                "subscription": None,
            }

        return {
            "status": subscription["status"],
            "hasFullAccess": has_promo or subscription["status"] == "active",
            "subscription": {
                "stripe_subscription_id": subscription["stripe_subscription_id"],
                "stripe_price_id": subscription["stripe_price_id"],
                "current_period_start": subscription["current_period_start"],
                "current_period_end": subscription["current_period_end"],
                "cancel_at_period_end": subscription["cancel_at_period_end"],
            },
        }

    except HTTPException:
        raise
    except Exception as ex:
        logger.error(ex)
        await users.close()
        raise HTTPException(status_code=500, detail=str(ex))


@router.post("/cancel-subscription")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["id"]
        await users.initialize()
        subscription = await users.get_subscription(user_id)

        if not subscription or not subscription["stripe_subscription_id"]:
            await users.close()
            raise HTTPException(status_code=400, detail="No active subscription")

        stripe.Subscription.modify(
            subscription["stripe_subscription_id"],
            cancel_at_period_end=True,
        )

        await users.upsert_subscription(
            user_id=user_id,
            cancel_at_period_end=True,
        )
        await users.close()

        return {"message": "Subscription will be cancelled at period end"}

    except HTTPException:
        raise
    except Exception as ex:
        logger.error(ex)
        await users.close()
        raise HTTPException(status_code=500, detail=str(ex))


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not configured")
        raise HTTPException(status_code=500, detail="Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError as e:
        logger.error(f"Invalid webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        await users.initialize()

        if event.type == "checkout.session.completed":
            session = event.data.object
            user_id = int(session.metadata.get("user_id", 0))
            price_id = session.metadata.get("price_id")

            if session.mode == "subscription":
                subs = stripe.Subscription.list(customer=session.customer, limit=1).data
                subscription = subs[0] if subs else None
                if subscription:
                    await users.upsert_subscription(
                        user_id=user_id,
                        stripe_customer_id=session.customer,
                        stripe_subscription_id=subscription.id,
                        stripe_price_id=price_id,
                        status="active",
                        current_period_start=subscription.current_period_start,
                        current_period_end=subscription.current_period_end,
                    )

        elif event.type == "customer.subscription.updated":
            subscription = event.data.object
            async with users._pool.acquire() as conn:
                user_id = await conn.fetchval(
                    "SELECT user_id FROM subscriptions WHERE stripe_customer_id=$1",
                    subscription.customer,
                )
            if user_id:
                await users.upsert_subscription(
                    user_id=user_id,
                    status=subscription.status,
                    current_period_start=subscription.current_period_start,
                    current_period_end=subscription.current_period_end,
                    cancel_at_period_end=subscription.cancel_at_period_end,
                )

        elif event.type == "customer.subscription.deleted":
            subscription = event.data.object
            async with users._pool.acquire() as conn:
                user_id = await conn.fetchval(
                    "SELECT user_id FROM subscriptions WHERE stripe_subscription_id=$1",
                    subscription.id,
                )
            if user_id:
                await users.upsert_subscription(user_id=user_id, status="cancelled")

        elif event.type == "invoice.payment_succeeded":
            invoice = event.data.object
            async with users._pool.acquire() as conn:
                user_id = await conn.fetchval(
                    "SELECT user_id FROM subscriptions WHERE stripe_customer_id=$1",
                    invoice.customer,
                )
            if user_id and invoice.payment_intent:
                await users.add_payment(
                    user_id=user_id,
                    stripe_payment_intent_id=invoice.payment_intent,
                    amount=invoice.amount_paid,
                    currency=invoice.currency,
                    status="succeeded",
                    payment_type="subscription",
                    description=f"Invoice {invoice.id}",
                )

        elif event.type == "invoice.payment_failed":
            invoice = event.data.object
            async with users._pool.acquire() as conn:
                user_id = await conn.fetchval(
                    "SELECT user_id FROM subscriptions WHERE stripe_customer_id=$1",
                    invoice.customer,
                )
            if user_id and invoice.payment_intent:
                await users.add_payment(
                    user_id=user_id,
                    stripe_payment_intent_id=invoice.payment_intent,
                    amount=invoice.amount_due,
                    currency=invoice.currency,
                    status="failed",
                    payment_type="subscription",
                    description=f"Invoice {invoice.id}",
                )

        await users.close()
        return {"received": True}

    except Exception as ex:
        logger.error(f"Webhook handler error: {ex}")
        try:
            await users.close()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Webhook processing failed")


@router.get("/history")
async def get_payment_history(current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["id"]
        await users.initialize()
        payments = await users.get_user_payment_history(user_id)
        await users.close()

        def ser(p):
            d = dict(p)
            for k, v in d.items():
                if hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
            return d

        return {"payments": [ser(p) for p in payments]}

    except HTTPException:
        raise
    except Exception as ex:
        logger.error(ex)
        await users.close()
        raise HTTPException(status_code=500, detail=str(ex))
