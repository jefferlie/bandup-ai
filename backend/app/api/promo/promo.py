from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger
from pathlib import Path
import asyncpg
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from core.config import DSN, PROMO_CODE
from db.db_functions import Users_DB
from api.deps import get_current_user
from api.limiter import limiter

router = APIRouter(
    prefix="/api/promo",
    tags=["Promo"],
)

_db = Users_DB(DSN)


class RedeemRequest(BaseModel):
    code: str


@router.post("/redeem")
@limiter.limit("5/hour")
async def redeem_promo(
    request: Request,
    body: RedeemRequest,
    current_user: dict = Depends(get_current_user),
):
    if not PROMO_CODE:
        raise HTTPException(status_code=503, detail="Promo codes are not configured")

    if body.code.strip().lower() != PROMO_CODE.strip().lower():
        raise HTTPException(status_code=400, detail="Invalid promo code")

    user_id = current_user["id"]

    await _db.initialize()
    try:
        async with _db._pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO promo_redemptions (user_id, promo_code) VALUES ($1, $2)",
                user_id,
                PROMO_CODE,
            )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="Promo code already redeemed for this account")
    except Exception as ex:
        logger.error(f"promo redeem error: {ex}")
        raise HTTPException(status_code=500, detail="Failed to redeem promo code")

    return JSONResponse({
        "success": True,
        "message": "Promo code applied. You now have full permanent access to all materials.",
    })


@router.get("/status")
async def promo_status(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    await _db.initialize()
    has_access = await _db.has_full_access(user_id)
    has_promo = await _db.has_redeemed_promo(user_id, PROMO_CODE) if PROMO_CODE else False
    await _db.close()

    return JSONResponse({
        "hasFullAccess": has_access,
        "hasPromoAccess": has_promo,
    })
