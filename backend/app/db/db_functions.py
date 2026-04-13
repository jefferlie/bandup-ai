import asyncio
import asyncpg
from loguru import logger
import json

from pathlib import Path
from datetime import datetime, date
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from core.models import UserModel, AttemptModel
from core.config import UserExistsException, DSN

DEFAULT_AVATAR_URL = "/avatars/avatar_1.png"
DEFAULT_TIMEZONE = "Asia/Almaty"
ALLOWED_PRIMARY_EXAMS = {"ielts", "sat"}
ALLOWED_SKILL_MODES = {"listening", "reading", "writing", "speaking"}
ALLOWED_STUDY_TIMES = {"morning", "afternoon", "evening", "flexible"}
ALLOWED_DISCOVERY_SOURCES = {
    "instagram",
    "youtube",
    "tiktok",
    "friend",
    "google",
    "school",
    "other",
}


def _to_bool(value, fallback: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "on"}:
            return True
        if lowered in {"false", "0", "no", "off"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return fallback


def _to_int(
    value, minimum: int, maximum: int, fallback: int | None = None
) -> int | None:
    if value in (None, ""):
        return fallback
    try:
        parsed = int(float(value))
    except Exception:
        return fallback
    return max(minimum, min(maximum, parsed))


def _to_float(value, minimum: float, maximum: float, fallback: float) -> float:
    try:
        parsed = float(value)
    except Exception:
        return fallback
    return max(minimum, min(maximum, round(parsed, 1)))


def _to_optional_float(value, minimum: float, maximum: float) -> float | None:
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
    except Exception:
        return None
    return max(minimum, min(maximum, round(parsed, 1)))


def _to_date_string(value) -> str:
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return ""
        try:
            return datetime.strptime(raw, "%Y-%m-%d").date().isoformat()
        except Exception:
            return ""
    return ""


def _to_primary_exam(value, fallback: str = "ielts") -> str:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ALLOWED_PRIMARY_EXAMS:
            return normalized
    return fallback


def _to_focus_skills(value) -> list[str]:
    if not isinstance(value, (list, tuple, set)):
        return []
    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        skill = item.strip().lower()
        if skill in ALLOWED_SKILL_MODES and skill not in normalized:
            normalized.append(skill)
    return normalized


def _to_study_time(value, fallback: str = "flexible") -> str:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ALLOWED_STUDY_TIMES:
            return normalized
    return fallback


def _to_discovery_source(value, fallback: str = "other") -> str:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ALLOWED_DISCOVERY_SOURCES:
            return normalized
    return fallback


def build_default_user_settings(
    name: str,
    email: str,
    onboarding: dict | None = None,
):
    source = onboarding or {}
    primary_exam = _to_primary_exam(source.get("primaryExam"), "ielts")
    target_band = _to_float(source.get("targetIeltsScore", 7.5), 0.0, 9.0, 7.5)
    current_band = _to_optional_float(source.get("currentIeltsScore"), 0.0, 9.0)
    target_exam_date = _to_date_string(source.get("targetExamDate"))
    target_sat = _to_int(source.get("targetSatScore"), 400, 1600, None)
    study_hours = _to_int(source.get("studyHoursPerWeek"), 1, 40, 6) or 6
    focus_skills = _to_focus_skills(source.get("focusSkills"))
    preferred_study_time = _to_study_time(source.get("preferredStudyTime"), "flexible")
    discovery_source = _to_discovery_source(source.get("discoverySource"), "other")

    return {
        "profile": {
            "name": name or "Student",
            "email": email or "",
            "avatarUrl": DEFAULT_AVATAR_URL,
            "phone": "",
            "timezone": DEFAULT_TIMEZONE,
        },
        "studyPreferences": {
            "targetBand": target_band,
            "currentBand": current_band,
            "examDate": target_exam_date,
            "primaryExam": primary_exam,
            "targetSatScore": target_sat,
            "studyHoursPerWeek": study_hours,
            "focusSkills": focus_skills,
            "preferredStudyTime": preferred_study_time,
            "discoverySource": discovery_source,
        },
        "security": {
            "twoFactorEnabled": False,
        },
        "notifications": {
            "emailAlerts": True,
            "studyReminders": True,
            "productUpdates": False,
        },
    }


def normalize_user_settings_payload(
    payload: dict | None,
    *,
    fallback_name: str,
    fallback_email: str,
):
    base = build_default_user_settings(fallback_name, fallback_email)
    if not isinstance(payload, dict):
        return base

    profile = (
        payload.get("profile", {}) if isinstance(payload.get("profile"), dict) else {}
    )
    study = (
        payload.get("studyPreferences", {})
        if isinstance(payload.get("studyPreferences"), dict)
        else {}
    )
    security = (
        payload.get("security", {}) if isinstance(payload.get("security"), dict) else {}
    )
    notifications = (
        payload.get("notifications", {})
        if isinstance(payload.get("notifications"), dict)
        else {}
    )

    primary_exam = _to_primary_exam(
        study.get("primaryExam"), base["studyPreferences"]["primaryExam"]
    )
    target_sat_score = _to_int(study.get("targetSatScore"), 400, 1600, None)
    focus_skills = (
        _to_focus_skills(study.get("focusSkills"))
        if "focusSkills" in study
        else list(base["studyPreferences"]["focusSkills"])
    )
    preferred_study_time = _to_study_time(
        study.get("preferredStudyTime"),
        base["studyPreferences"]["preferredStudyTime"],
    )
    discovery_source = _to_discovery_source(
        study.get("discoverySource"),
        base["studyPreferences"]["discoverySource"],
    )

    return {
        "profile": {
            "name": str(profile.get("name") or fallback_name or "Student"),
            "email": str(profile.get("email") or fallback_email or ""),
            "avatarUrl": str(profile.get("avatarUrl") or base["profile"]["avatarUrl"]),
            "phone": str(profile.get("phone") or ""),
            "timezone": str(profile.get("timezone") or base["profile"]["timezone"]),
        },
        "studyPreferences": {
            "targetBand": _to_float(
                study.get("targetBand"),
                0.0,
                9.0,
                base["studyPreferences"]["targetBand"],
            ),
            "currentBand": _to_optional_float(
                study.get("currentBand")
                if "currentBand" in study
                else base["studyPreferences"]["currentBand"],
                0.0,
                9.0,
            ),
            "examDate": _to_date_string(study.get("examDate")),
            "primaryExam": primary_exam,
            "targetSatScore": target_sat_score,
            "studyHoursPerWeek": _to_int(
                study.get("studyHoursPerWeek"),
                1,
                40,
                base["studyPreferences"]["studyHoursPerWeek"],
            )
            or base["studyPreferences"]["studyHoursPerWeek"],
            "focusSkills": focus_skills,
            "preferredStudyTime": preferred_study_time,
            "discoverySource": discovery_source,
        },
        "security": {
            "twoFactorEnabled": _to_bool(
                security.get("twoFactorEnabled"),
                base["security"]["twoFactorEnabled"],
            ),
        },
        "notifications": {
            "emailAlerts": _to_bool(
                notifications.get("emailAlerts"),
                base["notifications"]["emailAlerts"],
            ),
            "studyReminders": _to_bool(
                notifications.get("studyReminders"),
                base["notifications"]["studyReminders"],
            ),
            "productUpdates": _to_bool(
                notifications.get("productUpdates"),
                base["notifications"]["productUpdates"],
            ),
        },
    }


class Users_DB:
    def __init__(self, dsn: str):
        self._dsn = dsn
        self._pool: asyncpg.Pool | None = None

    async def initialize(self):
        """Get or create a connection pool (safe to call multiple times)."""
        try:
            if self._pool is None or self._pool._closed:
                self._pool = await asyncpg.create_pool(
                    dsn=self._dsn, min_size=2, max_size=10
                )
                async with self._pool.acquire() as conn:
                    await conn.execute("""
                        CREATE TABLE IF NOT EXISTS users(
                            id   SERIAL PRIMARY KEY,
                            full_name     VARCHAR(50) NOT NULL,
                            password_hash TEXT NOT NULL,
                            email TEXT NOT NULL
                        );
                    """)
                    await conn.execute("""
                        ALTER TABLE users
                        ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';
                    """)
                    await conn.execute("""
                        ALTER TABLE users
                        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
                    """)
                    await conn.execute("""
                        ALTER TABLE users
                        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
                    """)
                    await conn.execute("""
                        CREATE TABLE IF NOT EXISTS user_settings(
                            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                            settings_json JSONB NOT NULL,
                            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                    """)
                    await conn.execute("""
                        CREATE TABLE IF NOT EXISTS schedule_sessions(
                            session_id TEXT PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            mode VARCHAR(16) NOT NULL,
                            title TEXT NOT NULL,
                            session_date DATE NOT NULL,
                            start_time TIME NOT NULL,
                            duration_minutes INTEGER NOT NULL,
                            status VARCHAR(16) NOT NULL DEFAULT 'planned',
                            source VARCHAR(16) NOT NULL DEFAULT 'manual',
                            test_id TEXT NULL,
                            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                    """)
                    await conn.execute("""
                        CREATE INDEX IF NOT EXISTS idx_schedule_sessions_user_date
                        ON schedule_sessions(user_id, session_date, start_time);
                    """)
                    await conn.execute("""
                        CREATE TABLE IF NOT EXISTS subscriptions (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            stripe_customer_id VARCHAR(128),
                            stripe_subscription_id VARCHAR(128) UNIQUE,
                            stripe_price_id VARCHAR(128),
                            status VARCHAR(32) NOT NULL DEFAULT 'inactive',
                            current_period_start TIMESTAMP,
                            current_period_end TIMESTAMP,
                            cancel_at_period_end BOOLEAN DEFAULT FALSE,
                            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                    """)
                    await conn.execute("""
                        CREATE TABLE IF NOT EXISTS payments (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            stripe_payment_intent_id VARCHAR(128) UNIQUE,
                            stripe_charge_id VARCHAR(128),
                            amount INTEGER NOT NULL,
                            currency VARCHAR(3) NOT NULL DEFAULT 'usd',
                            status VARCHAR(32) NOT NULL DEFAULT 'pending',
                            payment_type VARCHAR(32) NOT NULL DEFAULT 'one_time',
                            description TEXT,
                            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                        );
                    """)
            return 0

        except Exception as ex:
            logger.error(ex)
            return 1

    async def _get_conn(self):
        """Acquire a connection from the pool."""
        if self._pool is None or self._pool._closed:
            await self.initialize()
        return self._pool.acquire()

    async def add_user(
        self,
        name: str,
        password: str,
        email: str,
        onboarding: dict | None = None,
    ):
        try:
            async with self._pool.acquire() as conn:
                is_user_exists = await conn.fetchval(
                    "SELECT EXISTS (SELECT 1 FROM users WHERE email = $1)", email
                )

                if is_user_exists:
                    raise UserExistsException(email)

                row = await conn.fetchrow(
                    """
                                    INSERT INTO users (full_name, password_hash, email) 
                                    VALUES ($1, $2, $3)
                                    RETURNING id, full_name, password_hash, email, role, is_admin, created_at
                                    """,
                    name,
                    password,
                    email,
                )

                default_settings = build_default_user_settings(name, email, onboarding)
                await conn.execute(
                    """
                    INSERT INTO user_settings(user_id, settings_json, updated_at)
                    VALUES ($1, $2::jsonb, NOW())
                    ON CONFLICT (user_id)
                    DO UPDATE SET settings_json = EXCLUDED.settings_json, updated_at = NOW()
                    """,
                    row["id"],
                    json.dumps(default_settings),
                )

                return UserModel(
                    name=row["full_name"],
                    password=row["password_hash"],
                    email=row["email"],
                    role=row["role"],
                    is_admin=row["is_admin"],
                    created_at=row["created_at"],
                )

        except UserExistsException as ex:
            logger.info(ex)
            return None

        except Exception as ex:
            logger.error(ex)
            return None

    async def get_user_from_email(self, email: str):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    "SELECT * FROM users WHERE email = $1", email
                )
                return result

        except Exception as ex:
            logger.error(ex)
            return None

    async def get_user_settings(
        self, user_id: int, fallback_name: str, fallback_email: str
    ):
        try:
            async with self._pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT settings_json FROM user_settings WHERE user_id=$1",
                    user_id,
                )
                if not row:
                    settings = build_default_user_settings(
                        fallback_name, fallback_email
                    )
                    await conn.execute(
                        """
                        INSERT INTO user_settings(user_id, settings_json, updated_at)
                        VALUES ($1, $2::jsonb, NOW())
                        ON CONFLICT (user_id)
                        DO UPDATE SET settings_json = EXCLUDED.settings_json, updated_at = NOW()
                        """,
                        user_id,
                        json.dumps(settings),
                    )
                    return settings

                settings_json = row["settings_json"]
                if isinstance(settings_json, str):
                    try:
                        parsed = json.loads(settings_json)
                    except Exception:
                        parsed = {}
                else:
                    parsed = dict(settings_json) if settings_json else {}

                normalized = normalize_user_settings_payload(
                    parsed,
                    fallback_name=fallback_name,
                    fallback_email=fallback_email,
                )
                return normalized

        except Exception as ex:
            logger.error(ex)
            return build_default_user_settings(fallback_name, fallback_email)

    async def upsert_user_settings(
        self,
        user_id: int,
        settings_payload: dict | None,
        fallback_name: str,
        fallback_email: str,
    ):
        try:
            normalized = normalize_user_settings_payload(
                settings_payload,
                fallback_name=fallback_name,
                fallback_email=fallback_email,
            )
            async with self._pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO user_settings(user_id, settings_json, updated_at)
                    VALUES ($1, $2::jsonb, NOW())
                    ON CONFLICT (user_id)
                    DO UPDATE SET settings_json = EXCLUDED.settings_json, updated_at = NOW()
                    """,
                    user_id,
                    json.dumps(normalized),
                )
            return normalized
        except Exception as ex:
            logger.error(ex)
            return build_default_user_settings(fallback_name, fallback_email)

    async def add_attempt(self, attempt: AttemptModel):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    "INSERT INTO attempts (attempt_id, user_id, mode, test_id, test_title)\
                        VALUES ($1, $2, $3, $4, $5) RETURNING attempt_id",
                    attempt.attempt_id,
                    attempt.user_id,
                    attempt.mode,
                    attempt.test_id,
                    attempt.test_title,
                )
                return result

        except Exception as ex:
            logger.error(ex)
            return None

    async def get_attempt(self, attempt_id):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    "SELECT * FROM attempts WHERE attempt_id=$1", attempt_id
                )
                return result

        except Exception as ex:
            logger.error(ex)
            return None

    async def get_mode_attempts(self, mode: str):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetch(
                    "SELECT * FROM attempts WHERE mode=$1 AND status IS NOT NULL ORDER BY submitted_at DESC NULLS LAST",
                    mode,
                )
                return result

        except Exception as ex:
            logger.error(ex)
            return []

    async def get_user_attempts(self, user_id: int):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetch(
                    "SELECT * FROM attempts WHERE user_id=$1 ORDER BY submitted_at DESC NULLS LAST",
                    user_id,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return []

    async def submit_attempt(
        self, attempt_id: str, score_label: str, status: str = "submitted"
    ):
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    "UPDATE attempts SET submitted_at = $1, score_label = $2, status = $3 WHERE attempt_id = $4",
                    datetime.utcnow(),
                    score_label,
                    status,
                    attempt_id,
                )
            return 0

        except Exception as ex:
            logger.error(ex)
            return 1

    async def get_schedule_sessions(self, user_id: int):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetch(
                    """
                    SELECT session_id, user_id, mode, title, session_date, start_time,
                           duration_minutes, status, source, test_id, created_at, updated_at
                    FROM schedule_sessions
                    WHERE user_id=$1
                    ORDER BY session_date ASC, start_time ASC
                    """,
                    user_id,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return []

    async def replace_schedule_sessions(self, user_id: int, sessions: list[dict]):
        try:
            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(
                        "DELETE FROM schedule_sessions WHERE user_id=$1", user_id
                    )

                    if sessions:
                        await conn.executemany(
                            """
                            INSERT INTO schedule_sessions(
                                session_id, user_id, mode, title, session_date, start_time,
                                duration_minutes, status, source, test_id, created_at, updated_at
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
                            )
                            """,
                            [
                                (
                                    session["session_id"],
                                    user_id,
                                    session["mode"],
                                    session["title"],
                                    session["session_date"],
                                    session["start_time"],
                                    session["duration_minutes"],
                                    session["status"],
                                    session["source"],
                                    session.get("test_id"),
                                    session["created_at"],
                                )
                                for session in sessions
                            ],
                        )
            return 0
        except Exception as ex:
            logger.error(ex)
            return 1

    async def get_schedule_session(self, user_id: int, session_id: str):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    SELECT session_id, user_id, mode, title, session_date, start_time,
                           duration_minutes, status, source, test_id, created_at, updated_at
                    FROM schedule_sessions
                    WHERE user_id=$1 AND session_id=$2
                    """,
                    user_id,
                    session_id,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return None

    async def create_schedule_session(self, user_id: int, session: dict):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    INSERT INTO schedule_sessions(
                        session_id, user_id, mode, title, session_date, start_time,
                        duration_minutes, status, source, test_id, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
                    )
                    RETURNING session_id, user_id, mode, title, session_date, start_time,
                              duration_minutes, status, source, test_id, created_at, updated_at
                    """,
                    session["session_id"],
                    user_id,
                    session["mode"],
                    session["title"],
                    session["session_date"],
                    session["start_time"],
                    session["duration_minutes"],
                    session["status"],
                    session["source"],
                    session.get("test_id"),
                    session["created_at"],
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return None

    async def update_schedule_session(
        self, user_id: int, session_id: str, session: dict
    ):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    UPDATE schedule_sessions
                    SET mode=$3,
                        title=$4,
                        session_date=$5,
                        start_time=$6,
                        duration_minutes=$7,
                        status=$8,
                        source=$9,
                        test_id=$10,
                        updated_at=NOW()
                    WHERE user_id=$1 AND session_id=$2
                    RETURNING session_id, user_id, mode, title, session_date, start_time,
                              duration_minutes, status, source, test_id, created_at, updated_at
                    """,
                    user_id,
                    session_id,
                    session["mode"],
                    session["title"],
                    session["session_date"],
                    session["start_time"],
                    session["duration_minutes"],
                    session["status"],
                    session["source"],
                    session.get("test_id"),
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return None

    async def delete_schedule_session(self, user_id: int, session_id: str):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.execute(
                    "DELETE FROM schedule_sessions WHERE user_id=$1 AND session_id=$2",
                    user_id,
                    session_id,
                )
                return int(result.split(" ")[-1])
        except Exception as ex:
            logger.error(ex)
            return 0

    async def get_subscription(self, user_id: int):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    "SELECT * FROM subscriptions WHERE user_id=$1",
                    user_id,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return None

    async def upsert_subscription(
        self,
        user_id: int,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
        stripe_price_id: str | None = None,
        status: str = "inactive",
        current_period_start=None,
        current_period_end=None,
        cancel_at_period_end: bool = False,
    ):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    INSERT INTO subscriptions (
                        user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
                        status, current_period_start, current_period_end, cancel_at_period_end
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (user_id) DO UPDATE SET
                        stripe_customer_id = COALESCE(NULLIF($2, ''), subscriptions.stripe_customer_id),
                        stripe_subscription_id = COALESCE(NULLIF($3, ''), subscriptions.stripe_subscription_id),
                        stripe_price_id = COALESCE(NULLIF($4, ''), subscriptions.stripe_price_id),
                        status = $5,
                        current_period_start = COALESCE($6, subscriptions.current_period_start),
                        current_period_end = COALESCE($7, subscriptions.current_period_end),
                        cancel_at_period_end = $8,
                        updated_at = NOW()
                    RETURNING *
                    """,
                    user_id,
                    stripe_customer_id,
                    stripe_subscription_id,
                    stripe_price_id,
                    status,
                    current_period_start,
                    current_period_end,
                    cancel_at_period_end,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return None

    async def get_user_payment_history(self, user_id: int):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetch(
                    "SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC",
                    user_id,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return []

    async def add_payment(
        self,
        user_id: int,
        stripe_payment_intent_id: str,
        amount: int,
        currency: str = "usd",
        status: str = "pending",
        payment_type: str = "one_time",
        description: str | None = None,
    ):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchrow(
                    """
                    INSERT INTO payments (
                        user_id, stripe_payment_intent_id, amount, currency,
                        status, payment_type, description
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *
                    """,
                    user_id,
                    stripe_payment_intent_id,
                    amount,
                    currency,
                    status,
                    payment_type,
                    description,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return None

    async def update_payment(
        self,
        stripe_payment_intent_id: str,
        status: str,
        stripe_charge_id: str | None = None,
    ):
        try:
            async with self._pool.acquire() as conn:
                await conn.execute(
                    "UPDATE payments SET status=$2, stripe_charge_id=$3, updated_at=NOW() WHERE stripe_payment_intent_id=$1",
                    stripe_payment_intent_id,
                    status,
                    stripe_charge_id,
                )
                return 0
        except Exception as ex:
            logger.error(ex)
            return 1

    async def get_all_users(self, limit: int = 100, offset: int = 0):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetch(
                    "SELECT id, full_name, email, role, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
                    limit,
                    offset,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return []

    async def get_all_payments(self, limit: int = 100, offset: int = 0):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetch(
                    "SELECT p.*, u.email, u.full_name FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT $1 OFFSET $2",
                    limit,
                    offset,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return []

    async def get_all_subscriptions(self, limit: int = 100, offset: int = 0):
        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetch(
                    "SELECT s.*, u.email, u.full_name FROM subscriptions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT $1 OFFSET $2",
                    limit,
                    offset,
                )
                return result
        except Exception as ex:
            logger.error(ex)
            return []

    async def close(self):
        """No-op for pool-based connections. Pool lives for the app lifetime."""
        pass


async def main():
    suers = Users_DB(dsn=DSN)
    await suers.initialize()
    await suers.close()


if __name__ == "__main__":
    asyncio.run(main())
