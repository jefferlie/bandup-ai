from fastapi import APIRouter, Depends, HTTPException, Header
from loguru import logger
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=False)

from db.db_functions import Users_DB
from core.config import DSN
from utils.security import verify_password

users = Users_DB(DSN)

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


async def get_current_admin(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    try:
        token = authorization.replace("Bearer ", "")
        await users.initialize()

        admin_user = await users._pool.fetchrow(
            "SELECT * FROM users WHERE is_admin = TRUE LIMIT 1"
        )

        if not admin_user:
            await users.close()
            raise HTTPException(status_code=403, detail="No admin user found")

        await users.close()
        return admin_user

    except HTTPException:
        raise
    except Exception as ex:
        logger.error(ex)
        raise HTTPException(status_code=500, detail="Internal server error")


class UserUpdate(BaseModel):
    is_admin: bool | None = None
    role: str | None = None


class SubscriptionUpdate(BaseModel):
    status: str
    extend_days: int | None = None


@router.get("/users")
async def get_all_users(
    limit: int = 100,
    offset: int = 0,
    admin: dict = Depends(get_current_admin),
):
    try:
        await users.initialize()
        result = await users.get_all_users(limit, offset)
        await users.close()
        return {"users": result}
    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    admin: dict = Depends(get_current_admin),
):
    try:
        await users.initialize()
        user = await users._pool.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        settings = await users.get_user_settings(
            user_id, user["full_name"], user["email"]
        )
        subscription = await users.get_subscription(user_id)
        payments = await users.get_user_payment_history(user_id)
        await users.close()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "user": user,
            "settings": settings,
            "subscription": subscription,
            "payments": payments,
        }
    except HTTPException:
        raise
    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    update: UserUpdate,
    admin: dict = Depends(get_current_admin),
):
    try:
        await users.initialize()

        if update.is_admin is not None:
            await users._pool.execute(
                "UPDATE users SET is_admin = $2 WHERE id = $1",
                user_id,
                update.is_admin,
            )

        if update.role is not None:
            await users._pool.execute(
                "UPDATE users SET role = $2 WHERE id = $1",
                user_id,
                update.role,
            )

        updated_user = await users._pool.fetchrow(
            "SELECT * FROM users WHERE id = $1",
            user_id,
        )
        await users.close()

        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")

        return {"user": updated_user}
    except HTTPException:
        raise
    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: dict = Depends(get_current_admin),
):
    try:
        await users.initialize()
        await users._pool.execute("DELETE FROM users WHERE id = $1", user_id)
        await users.close()
        return {"message": f"User {user_id} deleted"}
    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.get("/payments")
async def get_all_payments(
    limit: int = 100,
    offset: int = 0,
    admin: dict = Depends(get_current_admin),
):
    try:
        await users.initialize()
        result = await users.get_all_payments(limit, offset)
        await users.close()
        return {"payments": result}
    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.get("/subscriptions")
async def get_all_subscriptions(
    limit: int = 100,
    offset: int = 0,
    admin: dict = Depends(get_current_admin),
):
    try:
        await users.initialize()
        result = await users.get_all_subscriptions(limit, offset)
        await users.close()
        return {"subscriptions": result}
    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500


@router.get("/overview")
async def get_overview(admin: dict = Depends(get_current_admin)):
    """Aggregated overview for the admin panel frontend."""
    try:
        await users.initialize()

        total_users = await users._pool.fetchval("SELECT COUNT(*) FROM users")
        active_subs = await users._pool.fetchval(
            "SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"
        )
        total_revenue = await users._pool.fetchval(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'succeeded'"
        )
        total_payments = await users._pool.fetchval(
            "SELECT COUNT(*) FROM payments WHERE status = 'succeeded'"
        )

        all_users = await users._pool.fetch(
            """SELECT u.id, u.full_name, u.email, u.role, u.is_admin, u.created_at,
                      COALESCE(s.status, 'inactive') as subscription_status,
                      s.stripe_price_id, s.current_period_end
               FROM users u
               LEFT JOIN subscriptions s ON s.user_id = u.id
               ORDER BY u.created_at DESC LIMIT 200"""
        )

        all_subs = await users._pool.fetch(
            """SELECT s.*, u.email, u.full_name
               FROM subscriptions s
               JOIN users u ON s.user_id = u.id
               ORDER BY s.created_at DESC LIMIT 200"""
        )

        all_payments = await users._pool.fetch(
            """SELECT p.*, u.email, u.full_name
               FROM payments p JOIN users u ON p.user_id = u.id
               ORDER BY p.created_at DESC LIMIT 100"""
        )

        await users.close()

        def ser(row):
            if row is None:
                return None
            d = dict(row)
            for k, v in d.items():
                if hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
            return d

        return {
            "stats": {
                "totalUsers": total_users,
                "activeCourses": 0,
                "newReports": 0,
                "mediaFiles": 0,
                "activeUsers": active_subs,
                "newRegistrations": 0,
                "avgStudyHours": 0,
                "activeSubscriptions": active_subs,
                "totalRevenue": int(total_revenue),
                "totalPayments": total_payments,
            },
            "users": [ser(u) for u in all_users],
            "subscriptions": [ser(s) for s in all_subs],
            "payments": [ser(p) for p in all_payments],
            "reports": [],
            "media": [],
            "settings": {
                "autoModeration": False,
                "emailNotifications": True,
                "pushNotifications": False,
            },
        }
    except Exception as ex:
        logger.error(ex)
        try:
            await users.close()
        except Exception:
            pass
        return {"error": str(ex)}, 500


@router.get("/stats")
async def get_stats(admin: dict = Depends(get_current_admin)):
    try:
        await users.initialize()

        total_users = await users._pool.fetchval("SELECT COUNT(*) FROM users")
        total_payments = await users._pool.fetchval(
            "SELECT COUNT(*) FROM payments WHERE status = 'succeeded'"
        )
        total_revenue = await users._pool.fetchval(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'succeeded'"
        )
        active_subs = await users._pool.fetchval(
            "SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"
        )

        recent_users = await users._pool.fetch(
            "SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5"
        )
        recent_payments = await users._pool.fetch(
            "SELECT p.*, u.email, u.full_name FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 5"
        )

        await users.close()

        return {
            "total_users": total_users,
            "total_payments": total_payments,
            "total_revenue": total_revenue,
            "active_subscriptions": active_subs,
            "recent_users": recent_users,
            "recent_payments": recent_payments,
        }
    except Exception as ex:
        logger.error(ex)
        await users.close()
        return {"error": str(ex)}, 500
