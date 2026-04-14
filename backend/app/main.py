from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api import *
from api.payments.payments import router as payments_router
from api.admin.admin import router as admin_router
from core.config import IS_ON_PROD

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
    expose_headers=[],
    max_age=600,
)

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
from pathlib import Path

materials_path = Path(__file__).parent.parent / "materials"
app.mount("/materials", StaticFiles(directory=materials_path), name="materials")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=(not IS_ON_PROD))
