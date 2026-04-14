from datetime import datetime, date, time, timezone
from pathlib import Path
from uuid import uuid4
import sys

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from loguru import logger

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from core.config import DSN
from db.db_functions import Users_DB

database = Users_DB(DSN)

router = APIRouter(
    prefix="/api/schedule",
    tags=["Schedule"],
)

ALLOWED_MODES = {"listening", "reading", "writing", "speaking"}
ALLOWED_STATUS = {"planned", "completed", "missed"}
ALLOWED_SOURCE = {"manual", "autoplan", "catchup", "quick"}
ALLOWED_PATCH_FIELDS = {
    "mode",
    "title",
    "date",
    "startTime",
    "durationMinutes",
    "status",
    "source",
    "testId",
}


def parse_date(raw: str) -> date:
    return datetime.strptime(raw, "%Y-%m-%d").date()


def parse_time(raw: str) -> time:
    return datetime.strptime(raw, "%H:%M").time()


def parse_iso_datetime(raw: str) -> datetime:
    parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def serialize_session(row) -> dict:
    return {
        "id": row["session_id"],
        "mode": row["mode"],
        "title": row["title"],
        "date": row["session_date"].isoformat(),
        "startTime": row["start_time"].strftime("%H:%M"),
        "durationMinutes": int(row["duration_minutes"]),
        "status": row["status"],
        "source": row["source"],
        "testId": row["test_id"],
        "createdAt": row["created_at"].isoformat() if row["created_at"] else datetime.utcnow().isoformat(),
    }


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


def normalize_session_payload(
    payload: dict,
    *,
    fallback_session_id: str | None = None,
    fallback_created_at: datetime | None = None,
):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid session payload.")

    generated_id = f"session-{uuid4().hex[:12]}"
    session_id = str(payload.get("id") or fallback_session_id or generated_id).strip()
    mode = str(payload.get("mode", "")).strip()
    title = str(payload.get("title", "")).strip() or f"{mode.title()} Session"
    date_raw = str(payload.get("date", "")).strip()
    time_raw = str(payload.get("startTime", "")).strip()
    duration_raw = payload.get("durationMinutes", 20)
    status = str(payload.get("status", "planned")).strip()
    source = str(payload.get("source", "manual")).strip()
    test_id_raw = payload.get("testId")
    created_at_raw = payload.get("createdAt")

    if not session_id:
        raise HTTPException(status_code=400, detail="Session id is required.")
    if mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode '{mode}'.")
    if status not in ALLOWED_STATUS:
        status = "planned"
    if source not in ALLOWED_SOURCE:
        source = "manual"

    try:
        session_date = parse_date(date_raw)
        start_time = parse_time(time_raw)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid date or time format. Expected YYYY-MM-DD and HH:MM.",
        )

    try:
        duration_minutes = max(5, int(duration_raw))
    except Exception:
        duration_minutes = 20

    if isinstance(created_at_raw, str) and created_at_raw.strip():
        try:
            created_at = parse_iso_datetime(created_at_raw)
        except Exception:
            created_at = fallback_created_at or datetime.utcnow()
    else:
        created_at = fallback_created_at or datetime.utcnow()

    if test_id_raw is None:
        test_id = None
    elif isinstance(test_id_raw, str):
        stripped = test_id_raw.strip()
        test_id = stripped if stripped else None
    else:
        test_id = str(test_id_raw)

    return {
        "session_id": session_id,
        "mode": mode,
        "title": title,
        "session_date": session_date,
        "start_time": start_time,
        "duration_minutes": duration_minutes,
        "status": status,
        "source": source,
        "test_id": test_id,
        "created_at": created_at,
    }


@router.get("/")
async def get_schedule(email: str | None = Query(default=None)):
    try:
        await database.initialize()
        user_row = await resolve_user(email)
        if not user_row:
            return JSONResponse([], status_code=200)

        rows = await database.get_schedule_sessions(user_row["id"])
        await database.close()
        return JSONResponse([serialize_session(row) for row in rows])
    except Exception as ex:
        logger.error(ex)
        return JSONResponse([], status_code=500)


@router.put("/")
async def replace_schedule(
    payload: list[dict],
    email: str | None = Query(default=None),
):
    try:
        await database.initialize()
        user_row = await resolve_user(email)
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found for schedule.")

        if not isinstance(payload, list):
            raise HTTPException(status_code=400, detail="Payload must be an array of sessions.")

        normalized = [normalize_session_payload(session) for session in payload]

        result = await database.replace_schedule_sessions(user_row["id"], normalized)
        if result != 0:
            raise HTTPException(status_code=500, detail="Failed to save schedule.")

        rows = await database.get_schedule_sessions(user_row["id"])
        await database.close()
        return JSONResponse([serialize_session(row) for row in rows])

    except HTTPException as ex:
        return JSONResponse({"message": ex.detail}, status_code=ex.status_code)
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({"message": "Failed to replace schedule."}, status_code=500)


@router.post("/")
async def create_schedule(
    payload: dict,
    email: str | None = Query(default=None),
):
    try:
        await database.initialize()
        user_row = await resolve_user(email)
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found for schedule.")

        normalized = normalize_session_payload(payload)
        row = await database.create_schedule_session(user_row["id"], normalized)
        if not row:
            raise HTTPException(status_code=500, detail="Failed to create schedule session.")

        return JSONResponse(serialize_session(row))
    except HTTPException as ex:
        return JSONResponse({"message": ex.detail}, status_code=ex.status_code)
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({"message": "Failed to create schedule session."}, status_code=500)


@router.patch("/{session_id}")
async def patch_schedule(
    session_id: str,
    payload: dict,
    email: str | None = Query(default=None),
):
    try:
        await database.initialize()
        user_row = await resolve_user(email)
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found for schedule.")
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Patch payload must be an object.")

        unknown_fields = set(payload.keys()) - ALLOWED_PATCH_FIELDS
        if unknown_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported patch fields: {', '.join(sorted(unknown_fields))}.",
            )

        existing_row = await database.get_schedule_session(user_row["id"], session_id)
        if not existing_row:
            raise HTTPException(status_code=404, detail="Schedule session not found.")

        merged = {
            **serialize_session(existing_row),
            **payload,
            "id": session_id,
        }
        normalized = normalize_session_payload(
            merged,
            fallback_session_id=session_id,
            fallback_created_at=existing_row["created_at"],
        )

        row = await database.update_schedule_session(user_row["id"], session_id, normalized)
        if not row:
            raise HTTPException(status_code=500, detail="Failed to update schedule session.")

        return JSONResponse(serialize_session(row))
    except HTTPException as ex:
        return JSONResponse({"message": ex.detail}, status_code=ex.status_code)
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({"message": "Failed to update schedule session."}, status_code=500)


@router.delete("/{session_id}")
async def delete_schedule(
    session_id: str,
    email: str | None = Query(default=None),
):
    try:
        await database.initialize()
        user_row = await resolve_user(email)
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found for schedule.")

        deleted_count = await database.delete_schedule_session(user_row["id"], session_id)
        if deleted_count <= 0:
            raise HTTPException(status_code=404, detail="Schedule session not found.")

        return JSONResponse({"id": session_id, "deleted": True})
    except HTTPException as ex:
        return JSONResponse({"message": ex.detail}, status_code=ex.status_code)
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({"message": "Failed to delete schedule session."}, status_code=500)
