from fastapi.responses import JSONResponse
from fastapi import APIRouter, Header, Request

from loguru import logger
from uuid import uuid4
from dotenv import load_dotenv
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=False)

from core.models import Login_User, Register_User
from core.config import DSN
from db.db_functions import Users_DB
from utils.security import hash_password, verify_password
from api.limiter import limiter

users = Users_DB(DSN)

router = APIRouter(
    prefix="/auth",
    tags=["Authentification"],
)


def _serialize_user(row) -> dict:
    return {
        "id": row["id"],
        "name": row["full_name"],
        "email": row["email"],
        "role": row["role"],
        "isAdmin": row["is_admin"],
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
    }


@router.post("/login")
@limiter.limit("10/15minute")
async def login(request: Request, body: Login_User):
    email, password = body.email, body.password

    await users.initialize()
    user_fetch = await users.get_user_from_email(email=email)

    if not user_fetch:
        logger.info("User not found!")
        await users.close()
        return JSONResponse({'data': [None, None]}, status_code=201)

    if not verify_password(password, user_fetch['password_hash'].encode()):
        logger.info("Password wrong!")
        await users.close()
        return JSONResponse({'data': [None, None]}, status_code=201)

    token = str(uuid4())
    await users.create_session(token, user_fetch['id'])
    await users.close()

    return {'token': token, 'user': _serialize_user(user_fetch)}


@router.post("/register")
async def register(request: Register_User):
    name, email, password = request.name, request.email, hash_password(request.password).decode()
    onboarding = request.onboarding.dict(exclude_none=True) if request.onboarding else None

    await users.initialize()
    new_user = await users.add_user(name, password, email, onboarding)

    if new_user is None:
        await users.close()
        return {}

    user_fetch = await users.get_user_from_email(email)
    token = str(uuid4())
    await users.create_session(token, user_fetch['id'])
    await users.close()

    return {'token': token, 'user': _serialize_user(user_fetch)}


@router.post("/logout")
async def logout(authorization: str = Header(None)):
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        await users.initialize()
        await users.delete_session(token)
        await users.close()
    return {"message": "Logged out"}
