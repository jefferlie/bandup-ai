from fastapi import APIRouter
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

from core.config import BASE_URL
from db.db_functions import Users_DB
from core.config import DSN

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
    user_id: int


class CreateSubscriptionRequest(BaseModel):
    user_id: int
    price_id: str


@router.post("/create-checkout-session")
async def create_checkout_session(request: CreateCheckoutRequest):
    try:
        await users.initialize()

        user_data = await users.get_user_from_email(
            f"user_{request.user_id}@placeholder.com"
        )
        if not user_data:
            user_data = {"id": request.user_id}

        subscription = await users.get_subscription(request.user_id)
        customer_id = subscription["stripe_customer_id"] if subscription else None

        if not customer_id:
            customer = stripe.Customer.create(
                metadata={"user_id": str(request.user_id)}
            )
            customer_id = customer.id

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price": request.price_id,
                    "quantity": 1,
                }
            ],
            mode="subscription",
            success_url=f"{BASE_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{BASE_URL}/payment/cancel",
            metadata={
                "user_id": str(request.user_id),
                "price_id": request.price_id,
            },
        )

        await users.close()
        return {"checkout_url": session.url, "session_id": session.id}

    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.post("/create-subscription")
async def create_subscription(request: CreateSubscriptionRequest):
    try:
        price_id = PRICE_IDS.get(request.price_id)
        if not price_id:
            return {"error": "Invalid price_id"}, 400

        await users.initialize()
        subscription = await users.get_subscription(request.user_id)

        customer_id = subscription["stripe_customer_id"] if subscription else None

        if not customer_id:
            customer = stripe.Customer.create(
                metadata={"user_id": str(request.user_id)}
            )
            customer_id = customer.id

        stripe_sub = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"],
        )

        await users.upsert_subscription(
            user_id=request.user_id,
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

    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.get("/subscription-status/{user_id}")
async def get_subscription_status(user_id: int):
    try:
        await users.initialize()
        subscription = await users.get_subscription(user_id)
        await users.close()

        if not subscription:
            return {"status": "inactive", "subscription": None}

        return {
            "status": subscription["status"],
            "subscription": {
                "stripe_subscription_id": subscription["stripe_subscription_id"],
                "stripe_price_id": subscription["stripe_price_id"],
                "current_period_start": subscription["current_period_start"],
                "current_period_end": subscription["current_period_end"],
                "cancel_at_period_end": subscription["cancel_at_period_end"],
            },
        }

    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.post("/cancel-subscription/{user_id}")
async def cancel_subscription(user_id: int):
    try:
        await users.initialize()
        subscription = await users.get_subscription(user_id)
        await users.close()

        if not subscription or not subscription["stripe_subscription_id"]:
            return {"error": "No active subscription"}, 400

        stripe.Subscription.modify(
            subscription["stripe_subscription_id"],
            cancel_at_period_end=True,
        )

        await users.initialize()
        await users.upsert_subscription(
            user_id=user_id,
            cancel_at_period_end=True,
        )
        await users.close()

        return {"message": "Subscription will be cancelled at period end"}

    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.post("/webhook")
async def stripe_webhook(request: bytes):
    payload = request
    sig_header = None

    event = None

    try:
        event = stripe.Event.construct_from(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        return {"error": "Invalid payload"}, 400
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Signature verification failed: {e}")
        return {"error": "Invalid signature"}, 400

    try:
        if event.type == "checkout.session.completed":
            session = event.data.object
            user_id = int(session.metadata.get("user_id", 0))
            price_id = session.metadata.get("price_id")

            await users.initialize()

            subscription = (
                stripe.Subscription.list(customer=session.customer, limit=1).data[0]
                if session.mode == "subscription"
                else None
            )

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

            await users.close()

        elif event.type == "customer.subscription.updated":
            subscription = event.data.object
            await users.initialize()

            user_result = await users._pool.fetchval(
                "SELECT user_id FROM subscriptions WHERE stripe_customer_id=$1",
                subscription.customer,
            )

            if user_result:
                await users.upsert_subscription(
                    user_id=user_result,
                    status=subscription.status,
                    current_period_start=subscription.current_period_start,
                    current_period_end=subscription.current_period_end,
                    cancel_at_period_end=subscription.cancel_at_period_end,
                )

            await users.close()

        elif event.type == "customer.subscription.deleted":
            subscription = event.data.object
            await users.initialize()

            user_result = await users._pool.fetchval(
                "SELECT user_id FROM subscriptions WHERE stripe_subscription_id=$1",
                subscription.id,
            )

            if user_result:
                await users.upsert_subscription(
                    user_id=user_result,
                    status="cancelled",
                )

            await users.close()

        elif event.type == "invoice.payment_succeeded":
            invoice = event.data.object
            await users.initialize()

            user_result = await users._pool.fetchval(
                "SELECT user_id FROM subscriptions WHERE stripe_customer_id=$1",
                invoice.customer,
            )

            if user_result:
                await users.add_payment(
                    user_id=user_result,
                    stripe_payment_intent_id=invoice.payment_intent,
                    amount=invoice.amount_paid,
                    currency=invoice.currency,
                    status="succeeded",
                    payment_type="subscription",
                    description=f"Invoice {invoice.id}",
                )

            await users.close()

        elif event.type == "invoice.payment_failed":
            invoice = event.data.object
            await users.initialize()

            user_result = await users._pool.fetchval(
                "SELECT user_id FROM subscriptions WHERE stripe_customer_id=$1",
                invoice.customer,
            )

            if user_result:
                await users.add_payment(
                    user_id=user_result,
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
        logger.error(f"Webhook error: {ex}")
        return {"error": str(ex)}, 500


@router.get("/history/{user_id}")
async def get_payment_history(user_id: int):
    try:
        await users.initialize()
        payments = await users.get_user_payment_history(user_id)
        await users.close()

        return {"payments": payments}

    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500
