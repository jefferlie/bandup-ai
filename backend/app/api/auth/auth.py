from fastapi.responses import JSONResponse
from fastapi import APIRouter

from loguru import logger
from uuid import uuid4
from dotenv import load_dotenv
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=False)

from core.models import Login_User, Register_User, UserModel
from core.config import DSN
from db.db_functions import Users_DB
from utils.security import hash_password, verify_password

users = Users_DB(DSN)

router = APIRouter(
    prefix="/auth",
    tags=["Authentification"],
)

@router.post("/login")
async def login(request: Login_User):
    email, password = request.email, request.password
    
    await users.initialize()
    user_fetch = await users.get_user_from_email(email=email)
    await users.close()

    logger.info(user_fetch)

    if not user_fetch:
        logger.info("User not found!")
        return JSONResponse({'data': [None, None]}, status_code=201)

    if not verify_password(password, user_fetch['password_hash'].encode()):
        logger.info("Password wrong!")
        return JSONResponse({'data': [None, None]}, status_code=201)

    user = UserModel(name=user_fetch['full_name'], password=user_fetch['password_hash'], email=user_fetch['email'], role=user_fetch['role'], is_admin=user_fetch['is_admin'], created_at=user_fetch['created_at'])

    return {'token': str(uuid4()), 'user': user}


@router.post("/register")
async def register(request: Register_User):
    name, email, password = request.name, request.email, hash_password(request.password).decode()
    onboarding = request.onboarding.dict(exclude_none=True) if request.onboarding else None

    await users.initialize()
    user = await users.add_user(name, password, email, onboarding)
    await users.close()

    if user is None:
        return {}

    return {'token': str(uuid4()), 'user': user}
