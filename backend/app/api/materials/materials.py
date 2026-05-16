from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from core.config import IELTS_DB_PATH
from db.materials_db import IELTSMaterialsDB

router = APIRouter(
    prefix="/api/ielts/materials",
    tags=["IELTS Materials"],
)

_db = IELTSMaterialsDB(IELTS_DB_PATH)


@router.get("/books")
async def get_books():
    books = _db.get_books()
    return JSONResponse({"books": books})


@router.get("/reading/passages")
async def get_reading_passages(
    book_label: str | None = Query(None),
    book_number: int | None = Query(None),
    test_number: int | None = Query(None),
    passage_number: int | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    passages = _db.get_reading_passages(
        book_label=book_label,
        book_number=book_number,
        test_number=test_number,
        passage_number=passage_number,
        limit=limit,
        offset=offset,
    )
    total = _db.get_reading_passages_count(
        book_label=book_label,
        book_number=book_number,
        test_number=test_number,
        passage_number=passage_number,
    )
    return JSONResponse({
        "passages": passages,
        "count": len(passages),
        "total": total,
        "totalPages": max(1, (total + limit - 1) // limit),
    })


@router.get("/reading/passages/{passage_id}")
async def get_reading_passage(passage_id: int):
    passage = _db.get_reading_passage_full(passage_id)
    if not passage:
        raise HTTPException(status_code=404, detail="Passage not found")
    return JSONResponse(passage)


@router.get("/reading/questions")
async def get_reading_questions(
    book_label: str | None = Query(None),
    test_number: int | None = Query(None),
    passage_number: int | None = Query(None),
):
    questions = _db.get_reading_questions(
        book_label=book_label,
        test_number=test_number,
        passage_number=passage_number,
    )
    return JSONResponse({"questions": questions, "count": len(questions)})


@router.get("/listening/scripts")
async def get_listening_scripts(
    book_label: str | None = Query(None),
    test_number: int | None = Query(None),
    section_number: int | None = Query(None),
):
    scripts = _db.get_listening_scripts(
        book_label=book_label,
        test_number=test_number,
        section_number=section_number,
    )
    return JSONResponse({"scripts": scripts, "count": len(scripts)})


@router.get("/listening/questions")
async def get_listening_questions(
    book_label: str | None = Query(None),
    test_number: int | None = Query(None),
    section_number: int | None = Query(None),
):
    questions = _db.get_listening_questions(
        book_label=book_label,
        test_number=test_number,
        section_number=section_number,
    )
    return JSONResponse({"questions": questions, "count": len(questions)})


@router.get("/writing/tasks")
async def get_writing_tasks(
    task_type: int | None = Query(None, description="2 = Task 2"),
    min_band: float | None = Query(None, ge=4.0, le=9.0),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    random: bool = Query(False, description="Return in random order"),
):
    tasks = _db.get_writing_tasks(
        task_type=task_type,
        min_band=min_band,
        limit=limit,
        offset=offset,
        random_order=random,
    )
    total = _db.get_writing_tasks_count(task_type=task_type, min_band=min_band)
    return JSONResponse({
        "tasks": tasks,
        "count": len(tasks),
        "total": total,
        "totalPages": max(1, (total + limit - 1) // limit),
    })


@router.get("/writing/tasks/{task_id}")
async def get_writing_task(task_id: int):
    task = _db.get_writing_task_full(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Writing task not found")
    return JSONResponse(task)


@router.get("/speaking/questions")
async def get_speaking_questions(
    part: int | None = Query(None, description="1, 2, or 3"),
    topic: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    random: bool = Query(False, description="Return in random order"),
):
    if part is not None and part not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Part must be 1, 2, or 3")
    questions = _db.get_speaking_questions(
        part=part,
        topic=topic,
        limit=limit,
        offset=offset,
        random_order=random,
    )
    total = _db.get_speaking_questions_count(part=part, topic=topic)
    return JSONResponse({
        "questions": questions,
        "count": len(questions),
        "total": total,
        "totalPages": max(1, (total + limit - 1) // limit),
    })


@router.get("/answers")
async def get_answers(
    book_label: str = Query(...),
    test_number: int = Query(...),
):
    answers = _db.get_answers(book_label=book_label, test_number=test_number)
    return JSONResponse({"answers": answers, "count": len(answers)})
