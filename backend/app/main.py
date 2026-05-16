from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from api.limiter import limiter
from pathlib import Path
import time
import os

from api import *
from api.payments.payments import router as payments_router
from api.admin.admin import router as admin_router
from core.config import IS_ON_PROD, IELTS_DB_PATH, SAT_DB_PATH

START_TIME = time.time()

app = FastAPI(docs_url=None if IS_ON_PROD else "/docs", redoc_url=None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = (
    [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    if IS_ON_PROD
    else ["http://127.0.0.1:8080", "http://localhost:8080"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
    expose_headers=[],
    max_age=600,
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        if IS_ON_PROD:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(settings_router)
app.include_router(tests_router)
app.include_router(profile_router)
app.include_router(content_router)
app.include_router(practice_router)
app.include_router(ai_router)
app.include_router(schedule_router)
app.include_router(payments_router)
app.include_router(admin_router)
app.include_router(sat_router)
app.include_router(materials_router)
app.include_router(promo_router)

materials_path = Path(__file__).parent.parent / "materials"
app.mount("/materials", StaticFiles(directory=materials_path), name="materials")


@app.get("/api/health", tags=["Health"])
async def health():
    from core.config import DSN
    from db.db_functions import Users_DB

    db_status = "disconnected"
    try:
        _hdb = Users_DB(DSN)
        result = await _hdb.initialize()
        db_status = "connected" if result == 0 else "error"
    except Exception:
        db_status = "error"

    sqlite_status = "accessible" if IELTS_DB_PATH.exists() and SAT_DB_PATH.exists() else "missing"

    return JSONResponse({
        "status": "ok",
        "db": db_status,
        "sqlite": sqlite_status,
        "uptime": round(time.time() - START_TIME, 1),
    })


import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=(not IS_ON_PROD))
