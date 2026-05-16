from fastapi import HTTPException, Header
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(PROJECT_ROOT))

from db.db_functions import Users_DB
from core.config import DSN

_db = Users_DB(DSN)


def _extract_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if authorization.startswith("Bearer "):
        return authorization[7:].strip()
    return authorization.strip()


async def get_current_user(authorization: str = Header(None)):
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    await _db.initialize()
    user = await _db.get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return dict(user)


async def get_optional_user(authorization: str = Header(None)):
    token = _extract_token(authorization)
    if not token:
        return None
    await _db.initialize()
    user = await _db.get_user_by_token(token)
    return dict(user) if user else None


async def get_current_admin(authorization: str = Header(None)):
    user = await get_current_user(authorization)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
