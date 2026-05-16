"""Tests for Stripe webhook signature verification."""
from unittest.mock import AsyncMock, patch, MagicMock
import json
import os
import pytest


class TestWebhookSignature:
    def test_invalid_signature_returns_400(self, client):
        """With a configured secret, a bad signature should return 400."""
        payload = json.dumps({"type": "checkout.session.completed"}).encode()
        with patch.dict(os.environ, {"STRIPE_WEBHOOK_SECRET": "whsec_testsecret"}):
            r = client.post(
                "/payments/webhook",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "stripe-signature": "t=1,v1=invalidsig",
                },
            )
        assert r.status_code == 400

    def test_missing_webhook_secret_returns_500(self, client):
        """Without STRIPE_WEBHOOK_SECRET configured the endpoint returns 500."""
        payload = json.dumps({"type": "ping"}).encode()
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("STRIPE_WEBHOOK_SECRET", None)
            r = client.post(
                "/payments/webhook",
                content=payload,
                headers={"stripe-signature": "t=1,v1=sig"},
            )
        assert r.status_code == 500

    def test_valid_event_is_processed(self, client):
        """A valid stripe event (signature bypassed) returns {received: true}."""
        fake_event = MagicMock()
        fake_event.type = "checkout.session.completed"
        fake_event.data.object.metadata = {"user_id": "1", "price_id": "price_abc"}
        fake_event.data.object.mode = "payment"
        fake_event.data.object.customer = "cus_test"

        with patch.dict(os.environ, {"STRIPE_WEBHOOK_SECRET": "whsec_testsecret"}), \
             patch("stripe.Webhook.construct_event", return_value=fake_event), \
             patch("api.payments.payments.users.initialize", new_callable=AsyncMock), \
             patch("api.payments.payments.users.upsert_subscription", new_callable=AsyncMock), \
             patch("api.payments.payments.users.close", new_callable=AsyncMock), \
             patch("api.payments.payments.users._pool") as mock_pool:
            mock_conn = AsyncMock()
            mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
            mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

            payload = b'{"type": "checkout.session.completed"}'
            r = client.post(
                "/payments/webhook",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "stripe-signature": "t=1,v1=mocked",
                },
            )
        assert r.status_code == 200
        assert r.json()["received"] is True
