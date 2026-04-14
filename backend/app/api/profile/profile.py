from fastapi.responses import JSONResponse
from fastapi import APIRouter

from loguru import logger
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

router = APIRouter(
    prefix="/api/profile",
    tags=["Profile info"],
)

@router.get("/summary")
async def summary():
    return JSONResponse({
        "studyHoursLastMonth": 18,
        "progress": [
          {
            "subject": "Writing",
            "completed": 8,
            "total": 12,
            "lastActivity": "2026-02-19"
          }
        ],
        "achievements": [
          {
            "id": "p1",
            "title": "First Lesson",
            "description": "Completed your first lesson",
            "icon": "🎯",
            "earned": True
          }
        ]
      }
    )
