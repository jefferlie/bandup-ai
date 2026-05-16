"""Tests for POST /api/promo/redeem and GET /api/promo/status."""
from unittest.mock import AsyncMock, patch
import asyncpg
import pytest


def _auth_header(token="valid-token"):
    return {"Authorization": f"Bearer {token}"}


AUTHED_USER = {"id": 1, "email": "user@ex.com", "full_name": "User", "is_admin": False, "role": "student"}


class TestPromoRedeem:
    def test_valid_code_redeems_successfully(self, client):
        with patch("api.deps._db.initialize", new_callable=AsyncMock), \
             patch("api.deps._db.get_user_by_token", new_callable=AsyncMock, return_value=AUTHED_USER), \
             patch("api.promo.promo._db.initialize", new_callable=AsyncMock), \
             patch("api.promo.promo._db._pool") as mock_pool:
            mock_conn = AsyncMock()
            mock_conn.execute = AsyncMock(return_value=None)
            mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
            mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)
            r = client.post("/api/promo/redeem",
                            json={"code": "bird-grain-ocean"},
                            headers=_auth_header())
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_wrong_code_returns_400(self, client):
        with patch("api.deps._db.initialize", new_callable=AsyncMock), \
             patch("api.deps._db.get_user_by_token", new_callable=AsyncMock, return_value=AUTHED_USER):
            r = client.post("/api/promo/redeem",
                            json={"code": "wrong-code"},
                            headers=_auth_header())
        assert r.status_code == 400

    def test_unauthenticated_returns_401(self, client):
        r = client.post("/api/promo/redeem", json={"code": "bird-grain-ocean"})
        assert r.status_code == 401

    def test_double_redeem_returns_409(self, client):
        with patch("api.deps._db.initialize", new_callable=AsyncMock), \
             patch("api.deps._db.get_user_by_token", new_callable=AsyncMock, return_value=AUTHED_USER), \
             patch("api.promo.promo._db.initialize", new_callable=AsyncMock), \
             patch("api.promo.promo._db._pool") as mock_pool:
            mock_conn = AsyncMock()
            mock_conn.execute = AsyncMock(side_effect=asyncpg.UniqueViolationError())
            mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
            mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)
            r = client.post("/api/promo/redeem",
                            json={"code": "bird-grain-ocean"},
                            headers=_auth_header())
        assert r.status_code == 409
        assert "already redeemed" in r.json()["detail"].lower()

    def test_missing_code_field_returns_422(self, client):
        with patch("api.deps._db.initialize", new_callable=AsyncMock), \
             patch("api.deps._db.get_user_by_token", new_callable=AsyncMock, return_value=AUTHED_USER):
            r = client.post("/api/promo/redeem", json={}, headers=_auth_header())
        assert r.status_code == 422


class TestPromoStatus:
    def test_status_returns_access_flags(self, client):
        with patch("api.deps._db.initialize", new_callable=AsyncMock), \
             patch("api.deps._db.get_user_by_token", new_callable=AsyncMock, return_value=AUTHED_USER), \
             patch("api.promo.promo._db.initialize", new_callable=AsyncMock), \
             patch("api.promo.promo._db.has_full_access", new_callable=AsyncMock, return_value=True), \
             patch("api.promo.promo._db.has_redeemed_promo", new_callable=AsyncMock, return_value=True):
            r = client.get("/api/promo/status", headers=_auth_header())
        assert r.status_code == 200
        data = r.json()
        assert "hasFullAccess" in data
        assert "hasPromoAccess" in data
