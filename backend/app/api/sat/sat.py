from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from core.config import SAT_DB_PATH
from db.materials_db import SATMaterialsDB

router = APIRouter(
    prefix="/api/sat",
    tags=["SAT"],
)

_db = SATMaterialsDB(SAT_DB_PATH)

ALLOWED_SECTIONS = {"math", "english", "practice_test"}
ALLOWED_DIFFICULTIES = {"Easy", "Medium", "Hard"}


@router.get("/questions")
async def get_questions(
    section: str | None = Query(None, description="math | english | practice_test"),
    domain: str | None = Query(None),
    difficulty: str | None = Query(None, description="Easy | Medium | Hard"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    if section and section not in ALLOWED_SECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid section. Must be one of {ALLOWED_SECTIONS}")
    if difficulty and difficulty not in ALLOWED_DIFFICULTIES:
        raise HTTPException(status_code=400, detail=f"Invalid difficulty. Must be one of {ALLOWED_DIFFICULTIES}")

    questions = _db.get_questions(
        section=section,
        domain=domain,
        difficulty=difficulty,
        limit=limit,
        offset=offset,
    )
    total = _db.get_total_count(section=section, difficulty=difficulty)

    return JSONResponse({
        "questions": questions,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "totalPages": max(1, (total + limit - 1) // limit),
            "page": offset // limit + 1,
        },
    })


@router.get("/questions/random")
async def get_random_questions(
    section: str | None = Query(None, description="math | english | practice_test"),
    difficulty: str | None = Query(None, description="Easy | Medium | Hard"),
    count: int = Query(10, ge=1, le=50),
):
    if section and section not in ALLOWED_SECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid section")
    if difficulty and difficulty not in ALLOWED_DIFFICULTIES:
        raise HTTPException(status_code=400, detail=f"Invalid difficulty")

    questions = _db.get_random_questions(section=section, difficulty=difficulty, count=count)
    return JSONResponse({"questions": questions, "count": len(questions)})


@router.get("/questions/{question_id}")
async def get_question(question_id: str):
    question = _db.get_question_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return JSONResponse(question)


@router.get("/domains")
async def get_domains():
    domains = _db.get_domains()
    return JSONResponse({"domains": domains})


@router.get("/stats")
async def get_stats():
    total = _db.get_total_count()
    by_section = {
        "math": _db.get_total_count(section="math"),
        "english": _db.get_total_count(section="english"),
        "practice_test": _db.get_total_count(section="practice_test"),
    }
    by_difficulty = {
        d: _db.get_total_count(difficulty=d) for d in ALLOWED_DIFFICULTIES
    }
    return JSONResponse({
        "total": total,
        "bySection": by_section,
        "byDifficulty": by_difficulty,
    })
