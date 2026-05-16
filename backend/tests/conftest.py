"""
Shared test fixtures. Import-time patches must run BEFORE any api.* import,
so the ordering in this file is intentional — do not rearrange.
"""
import sys
import os
from pathlib import Path
from functools import wraps
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch
import importlib.util

APP_DIR = Path(__file__).parent.parent / "app"
sys.path.insert(0, str(APP_DIR))

# ── 1. Patch slowapi.Limiter FIRST (before any api.* import) ─────────────────
#    api/limiter.py does `from slowapi import Limiter; limiter = Limiter(...)`.
#    If we replace Limiter here, the decorators in auth.py / promo.py become no-ops.
import slowapi as _slowapi_pkg
from slowapi import _rate_limit_exceeded_handler  # noqa: F401 — needed by main.py
from slowapi.errors import RateLimitExceeded      # noqa: F401


class _NoOpLimiter:
    """Replaces the real slowapi Limiter in tests — applies no rate limiting."""
    def limit(self, *args, **kwargs):
        def decorator(f):
            return f           # return original function unchanged
        return decorator

    key_func = staticmethod(lambda request: "test")


_slowapi_pkg.Limiter = lambda **kw: _NoOpLimiter()

# ── 2. Stub heavy optional deps that may not be installed in the test venv ────
def _stub_module(name: str) -> ModuleType:
    mod = ModuleType(name)
    sys.modules[name] = mod
    return mod

for _name in ("google", "google.generativeai", "language_tool_python"):
    if _name not in sys.modules:
        _stub_module(_name)

import google.generativeai as _genai  # noqa: F401 (now the stub)
_genai.configure = lambda **_kw: None
_genai.GenerativeModel = MagicMock

# ── 3. pytest fixtures ────────────────────────────────────────────────────────
import pytest
from fastapi.testclient import TestClient


def make_user(id=1, email="test@example.com", full_name="Test User",
              is_admin=False, role="student"):
    return {
        "id": id, "full_name": full_name, "email": email,
        "role": role, "is_admin": is_admin, "created_at": None,
        "password_hash": "$2b$12$somehash",
    }


@pytest.fixture(scope="session")
def app():
    """Load app/main.py with DB pool init mocked out."""
    with patch("db.db_functions.Users_DB.initialize", new_callable=AsyncMock, return_value=0), \
         patch("db.db_functions.Users_DB.close", new_callable=AsyncMock):
        spec = importlib.util.spec_from_file_location("appmain", APP_DIR / "main.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        yield mod.app


@pytest.fixture(scope="session")
def client(app):
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
