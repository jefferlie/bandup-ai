"""Tests for POST /auth/login and POST /auth/register."""
from unittest.mock import AsyncMock, patch
import pytest


# ── login ─────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_wrong_password_returns_201_with_nulls(self, client):
        fake_user = {
            "id": 1, "full_name": "Alice", "email": "alice@ex.com",
            "password_hash": "$2b$12$invalid", "role": "student",
            "is_admin": False, "created_at": None,
        }
        with patch("api.auth.auth.users.get_user_from_email", new_callable=AsyncMock, return_value=fake_user), \
             patch("api.auth.auth.verify_password", return_value=False):
            r = client.post("/auth/login", json={"email": "alice@ex.com", "password": "wrong"})
        assert r.status_code == 201
        assert r.json()["data"] == [None, None]

    def test_nonexistent_user_returns_201_with_nulls(self, client):
        with patch("api.auth.auth.users.get_user_from_email", new_callable=AsyncMock, return_value=None):
            r = client.post("/auth/login", json={"email": "ghost@ex.com", "password": "x"})
        assert r.status_code == 201
        assert r.json()["data"] == [None, None]

    def test_valid_login_returns_token_and_user(self, client):
        import bcrypt
        pw_hash = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
        fake_user = {
            "id": 42, "full_name": "Bob", "email": "bob@ex.com",
            "password_hash": pw_hash, "role": "student",
            "is_admin": False, "created_at": None,
        }
        with patch("api.auth.auth.users.get_user_from_email", new_callable=AsyncMock, return_value=fake_user), \
             patch("api.auth.auth.users.create_session", new_callable=AsyncMock, return_value=0):
            r = client.post("/auth/login", json={"email": "bob@ex.com", "password": "secret"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["id"] == 42
        assert data["user"]["email"] == "bob@ex.com"
        assert "password" not in data["user"]
        assert "password_hash" not in data["user"]

    def test_invalid_email_format_returns_422(self, client):
        r = client.post("/auth/login", json={"email": "not-an-email", "password": "x"})
        assert r.status_code == 422

    def test_missing_fields_returns_422(self, client):
        r = client.post("/auth/login", json={"email": "a@b.com"})
        assert r.status_code == 422


# ── register ──────────────────────────────────────────────────────────────────

class TestRegister:
    def test_successful_registration_returns_token(self, client):
        from core.models import UserModel
        from datetime import datetime
        fake_new_user = UserModel(
            name="Carol", email="carol@ex.com", password="hashed",
            role="student", is_admin=False, created_at=datetime.utcnow(),
        )
        fake_row = {
            "id": 7, "full_name": "Carol", "email": "carol@ex.com",
            "role": "student", "is_admin": False, "created_at": datetime.utcnow(),
        }
        with patch("api.auth.auth.users.add_user", new_callable=AsyncMock, return_value=fake_new_user), \
             patch("api.auth.auth.users.get_user_from_email", new_callable=AsyncMock, return_value=fake_row), \
             patch("api.auth.auth.users.create_session", new_callable=AsyncMock, return_value=0):
            r = client.post("/auth/register", json={
                "name": "Carol", "email": "carol@ex.com", "password": "pass123"
            })
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["id"] == 7

    def test_duplicate_email_returns_empty(self, client):
        with patch("api.auth.auth.users.add_user", new_callable=AsyncMock, return_value=None):
            r = client.post("/auth/register", json={
                "name": "Dave", "email": "existing@ex.com", "password": "pw"
            })
        assert r.status_code == 200
        assert r.json() == {}

    def test_missing_name_returns_422(self, client):
        r = client.post("/auth/register", json={"email": "a@b.com", "password": "pw"})
        assert r.status_code == 422

    def test_logout_endpoint_exists(self, client):
        with patch("api.auth.auth.users.delete_session", new_callable=AsyncMock, return_value=0):
            r = client.post("/auth/logout", headers={"Authorization": "Bearer sometoken"})
        assert r.status_code == 200
