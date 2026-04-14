from fastapi.responses import JSONResponse
from fastapi import APIRouter, Query
from typing import Optional

from loguru import logger
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

router = APIRouter(
    tags=["Tests info"],
)

def apply_filters(tests, search, questionType, length, examType):
    filtered = []
    for t in tests:
        if search and search.lower() not in t["title"].lower() and search.lower() not in t["subtitle"].lower():
            continue
        if questionType and questionType.lower() not in t.get("type", "").lower() and questionType.lower() not in t.get("subtitle", "").lower():
            continue
        badges_text = " ".join([b["label"].lower() for b in t.get("badges", [])])
        if length and length.lower() not in badges_text:
            continue
        if examType and examType.lower() not in badges_text:
            continue
        filtered.append(t)
    return filtered

@router.get("/api/ielts/tests/reading")
async def reading(
    page: int = Query(1),
    limit: int = Query(15),
    search: Optional[str] = None,
    questionType: Optional[str] = None,
    length: Optional[str] = None,
    examType: Optional[str] = None
):
    tests = [
      {
        "id": "r1",
        "title": "Cambridge IELTS 20 Test 1",
        "subtitle": "Full Test",
        "type": "Full Test",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "Full Test (60 mins)", "bg": "bg-purple-100 dark:bg-purple-900/30", "text": "text-purple-800 dark:text-purple-300"}
        ]
      },
      {
        "id": "r1-part1",
        "title": "Cambridge IELTS 20 Test 1 (Questions 1-13)",
        "subtitle": "Passage 1 · Georgia O'Keeffe",
        "type": "Passage 1",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "One Passage (20 mins)", "bg": "bg-green-100 dark:bg-green-900/30", "text": "text-green-800 dark:text-green-300"}
        ]
      },
      {
        "id": "r1-part2",
        "title": "Cambridge IELTS 20 Test 1 (Questions 14-26)",
        "subtitle": "Passage 2 · Adapting to the effects of climate change",
        "type": "Passage 2",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "One Passage (20 mins)", "bg": "bg-green-100 dark:bg-green-900/30", "text": "text-green-800 dark:text-green-300"}
        ]
      },
      {
        "id": "r1-part3",
        "title": "Cambridge IELTS 20 Test 1 (Questions 27-40)",
        "subtitle": "Passage 3 · A new role for livestock guard dogs",
        "type": "Passage 3",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "One Passage (20 mins)", "bg": "bg-green-100 dark:bg-green-900/30", "text": "text-green-800 dark:text-green-300"}
        ]
      }
    ]
    filtered_tests = apply_filters(tests, search, questionType, length, examType)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = filtered_tests[start_idx:end_idx]

    return JSONResponse({
        "tests": paginated,
        "pagination": {
          "page": page,
          "limit": limit,
          "total": len(filtered_tests),
          "totalPages": max(1, (len(filtered_tests) + limit - 1) // limit)
        }
      }
    )

@router.get("/api/ielts/tests/listening")
async def listening(
    page: int = Query(1),
    limit: int = Query(15),
    search: Optional[str] = None,
    questionType: Optional[str] = None,
    length: Optional[str] = None,
    examType: Optional[str] = None
):
    tests = [
      {
        "id": "l1",
        "title": "Cambridge IELTS 20 Academic Listening Test 4",
        "subtitle": "Full Test",
        "type": "Full Test",
        "badges": [
          {
            "label": "Academic",
            "bg": "bg-blue-100 dark:bg-blue-900/30",
            "text": "text-blue-800 dark:text-blue-300"
          },
          {
            "label": "Full Test (40 mins)",
            "bg": "bg-green-100 dark:bg-green-900/30",
            "text": "text-green-800 dark:text-green-300"
          }
        ]
      },
      {
        "id": "l1-part1",
        "title": "Cambridge IELTS 20 Academic Listening Test 4 (Questions 1-10)",
        "subtitle": "Part 1",
        "type": "Part 1",
        "badges": [
          {
            "label": "Academic",
            "bg": "bg-blue-100 dark:bg-blue-900/30",
            "text": "text-blue-800 dark:text-blue-300"
          },
          {
            "label": "Short Practice (10 mins)",
            "bg": "bg-green-100 dark:bg-green-900/30",
            "text": "text-green-800 dark:text-green-300"
          }
        ]
      },
      {
        "id": "l1-part2",
        "title": "Cambridge IELTS 20 Academic Listening Test 4 (Questions 11-20)",
        "subtitle": "Part 2",
        "type": "Part 2",
        "badges": [
          {
            "label": "Academic",
            "bg": "bg-blue-100 dark:bg-blue-900/30",
            "text": "text-blue-800 dark:text-blue-300"
          },
          {
            "label": "Short Practice (10 mins)",
            "bg": "bg-green-100 dark:bg-green-900/30",
            "text": "text-green-800 dark:text-green-300"
          }
        ]
      },
      {
        "id": "l1-part3",
        "title": "Cambridge IELTS 20 Academic Listening Test 4 (Questions 21-30)",
        "subtitle": "Part 3",
        "type": "Part 3",
        "badges": [
          {
            "label": "Academic",
            "bg": "bg-blue-100 dark:bg-blue-900/30",
            "text": "text-blue-800 dark:text-blue-300"
          },
          {
            "label": "Short Practice (10 mins)",
            "bg": "bg-green-100 dark:bg-green-900/30",
            "text": "text-green-800 dark:text-green-300"
          }
        ]
      },
      {
        "id": "l1-part4",
        "title": "Cambridge IELTS 20 Academic Listening Test 4 (Questions 31-40)",
        "subtitle": "Part 4",
        "type": "Part 4",
        "badges": [
          {
            "label": "Academic",
            "bg": "bg-blue-100 dark:bg-blue-900/30",
            "text": "text-blue-800 dark:text-blue-300"
          },
          {
            "label": "Short Practice (10 mins)",
            "bg": "bg-green-100 dark:bg-green-900/30",
            "text": "text-green-800 dark:text-green-300"
          }
        ]
      }
    ]

    filtered_tests = apply_filters(tests, search, questionType, length, examType)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = filtered_tests[start_idx:end_idx]

    return JSONResponse({
        "tests": paginated,
        "pagination": {
          "page": page,
          "limit": limit,
          "total": len(filtered_tests),
          "totalPages": max(1, (len(filtered_tests) + limit - 1) // limit)
        }
      }
    )

@router.get("/api/ielts/tests/writing")
async def writing(
    page: int = Query(1),
    limit: int = Query(15),
    search: Optional[str] = None,
    questionType: Optional[str] = None,
    length: Optional[str] = None,
    examType: Optional[str] = None
):
    tests = [
      {
        "id": "w1",
        "title": "Cambridge IELTS Practice Writing",
        "subtitle": "Task 1 & Task 2",
        "type": "Full Test",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "Full Test (60 mins)", "bg": "bg-purple-100 dark:bg-purple-900/30", "text": "text-purple-800 dark:text-purple-300"}
        ]
      },
      {
        "id": "w1-task1",
        "title": "Cambridge IELTS Practice Writing (Task 1)",
        "subtitle": "Graph/Diagram Description",
        "type": "Task 1",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "Short Practice (20 mins)", "bg": "bg-green-100 dark:bg-green-900/30", "text": "text-green-800 dark:text-green-300"}
        ]
      },
      {
        "id": "w1-task2",
        "title": "Cambridge IELTS Practice Writing (Task 2)",
        "subtitle": "Essay Response",
        "type": "Task 2",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "Medium Practice (40 mins)", "bg": "bg-amber-100 dark:bg-amber-900/30", "text": "text-amber-800 dark:text-amber-300"}
        ]
      }
    ]
    filtered_tests = apply_filters(tests, search, questionType, length, examType)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = filtered_tests[start_idx:end_idx]

    return JSONResponse({
        "tests": paginated,
        "pagination": {
          "page": page,
          "limit": limit,
          "total": len(filtered_tests),
          "totalPages": max(1, (len(filtered_tests) + limit - 1) // limit)
        }
      }
    )

@router.get("/api/ielts/tests/speaking")
async def speaking(
    page: int = Query(1),
    limit: int = Query(15),
    search: Optional[str] = None,
    questionType: Optional[str] = None,
    length: Optional[str] = None,
    examType: Optional[str] = None
):
    tests = [
      {
        "id": "s1",
        "title": "Cambridge IELTS 20 Academic Speaking Test 4",
        "subtitle": "Full Interview (Part 1, 2, 3)",
        "type": "Full Test",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "Full Test (15 mins)", "bg": "bg-purple-100 dark:bg-purple-900/30", "text": "text-purple-800 dark:text-purple-300"}
        ]
      },
      {
        "id": "s1-part1",
        "title": "Cambridge IELTS 20 Academic Speaking Test 4 (Part 1)",
        "subtitle": "Introduction and Interview",
        "type": "Part 1",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "Short Practice (5 mins)", "bg": "bg-green-100 dark:bg-green-900/30", "text": "text-green-800 dark:text-green-300"}
        ]
      },
      {
        "id": "s1-part2",
        "title": "Cambridge IELTS 20 Academic Speaking Test 4 (Part 2)",
        "subtitle": "Long Turn",
        "type": "Part 2",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "Short Practice (5 mins)", "bg": "bg-green-100 dark:bg-green-900/30", "text": "text-green-800 dark:text-green-300"}
        ]
      },
      {
        "id": "s1-part3",
        "title": "Cambridge IELTS 20 Academic Speaking Test 4 (Part 3)",
        "subtitle": "Discussion",
        "type": "Part 3",
        "badges": [
          {"label": "Academic", "bg": "bg-blue-100 dark:bg-blue-900/30", "text": "text-blue-800 dark:text-blue-300"},
          {"label": "Short Practice (5 mins)", "bg": "bg-green-100 dark:bg-green-900/30", "text": "text-green-800 dark:text-green-300"}
        ]
      }
    ]
    filtered_tests = apply_filters(tests, search, questionType, length, examType)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated = filtered_tests[start_idx:end_idx]

    return JSONResponse({
        "tests": paginated,
        "pagination": {
          "page": page,
          "limit": limit,
          "total": len(filtered_tests),
          "totalPages": max(1, (len(filtered_tests) + limit - 1) // limit)
        }
      }
    )


