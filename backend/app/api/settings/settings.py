from fastapi.responses import JSONResponse
from fastapi import APIRouter, Query, HTTPException

from loguru import logger
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from core.config import DSN
from db.db_functions import Users_DB, build_default_user_settings

database = Users_DB(DSN)

router = APIRouter(
    prefix="/api/settings",
    tags=["Settings info"],
)


async def resolve_user(email: str | None):
    candidates = []
    if email:
        candidates.append(email)
    candidates.extend(["test@test.com", "guest@example.com"])

    for candidate in candidates:
        user_row = await database.get_user_from_email(candidate)
        if user_row:
            return user_row
    return None


@router.get("/")
async def settings(email: str | None = Query(default=None)):
    try:
        await database.initialize()
        user_row = await resolve_user(email)
        if not user_row:
            fallback_email = email or "student@example.com"
            fallback_settings = build_default_user_settings("Student", fallback_email)
            return JSONResponse(fallback_settings, status_code=200)

        payload = await database.get_user_settings(
            user_row["id"],
            user_row["full_name"],
            user_row["email"],
        )
        return JSONResponse(payload, status_code=200)
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({"message": "Failed to load settings."}, status_code=500)


@router.put("/")
async def update_settings(
    request: dict,
    email: str | None = Query(default=None),
):
    try:
        await database.initialize()
        user_row = await resolve_user(email)
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found for settings.")

        updated = await database.upsert_user_settings(
            user_row["id"],
            request,
            fallback_name=user_row["full_name"],
            fallback_email=user_row["email"],
        )
        return JSONResponse(updated, status_code=200)
    except HTTPException as ex:
        return JSONResponse({"message": ex.detail}, status_code=ex.status_code)
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({"message": "Failed to update settings."}, status_code=500)
