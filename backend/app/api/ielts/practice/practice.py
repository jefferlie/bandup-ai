from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
from fastapi.requests import Request

from typing import Literal
from loguru import logger
from uuid import uuid4
from pathlib import Path
import sys
import json
import re

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from core.models import AttemptModel
from core.config import DSN
from db.db_functions import Users_DB
from api.ai.main import evaluate_writing_with_gemini, evaluate_speaking_with_gemini

IELTS_DIR = Path(__file__).resolve().parents[4] / 'materials' / 'ielts'

database = Users_DB(DSN)

router = APIRouter(
    prefix="/api/ielts/practice",
    tags=["Practice Tests"],
)


def parse_part_test_id(test_id: str) -> tuple[str, int | None]:
    """
    Supported part IDs:
    - l1-part1
    - l1_part1
    """
    match = re.match(r"^(?P<base>.+?)[-_]part(?P<num>[1-4])$", test_id)
    if not match:
        return test_id, None
    return match.group("base"), int(match.group("num"))


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def _get_guest_user_id() -> int:
    user_row = await database.get_user_from_email("guest@example.com")
    if not user_row:
        await database.add_user("Guest", "none", "guest@example.com")
        user_row = await database.get_user_from_email("guest@example.com")
    if not user_row:
        raise HTTPException(status_code=500, detail="Could not resolve user for attempt.")
    return user_row["id"]


async def resolve_user_id(authorization: str | None) -> int:
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        user_row = await database.get_user_by_token(token)
        if user_row:
            return user_row["id"]
    return await _get_guest_user_id()


def load_mode_test(mode: Literal["writing", "speaking"], test_id: str) -> dict:
    mode_dir = IELTS_DIR / mode
    exact_path = mode_dir / f"{test_id}.json"

    if exact_path.exists():
        raw = load_json(exact_path)
        return raw["test"] if "test" in raw else raw

    for candidate_path in sorted(mode_dir.glob("*.json")):
        raw = load_json(candidate_path)
        test_data = raw["test"] if "test" in raw else raw
        if test_data.get("testId") == test_id:
            return test_data

    raise FileNotFoundError(f"{mode} test '{test_id}' was not found.")


@router.get("/{mode}/attempts")
async def attempts(
    mode: Literal['reading', 'listening', 'writing', 'speaking'],
    limit: int = 5,
    authorization: str = Header(None),
):
    try:
        await database.initialize()
        user_id = await resolve_user_id(authorization)

        raw = await database.get_user_mode_attempts(user_id=user_id, mode=mode)

        attempts_ = []
        for attempt in raw[: max(limit, 0)]:
            submitted_at = attempt["submitted_at"]
            attempts_.append({
                "id": attempt["attempt_id"],
                "mode": attempt["mode"],
                "testId": attempt["test_id"],
                "testTitle": attempt["test_title"],
                "submittedAt": submitted_at.isoformat() if submitted_at else "",
                "scoreLabel": attempt["score_label"] or "Pending review",
                "status": attempt["status"] or "submitted",
            })

        await database.close()
        return JSONResponse(attempts_)

    except Exception as ex:
        logger.error(ex)
        return JSONResponse([], status_code=500)


@router.post("/reading/{attempt_id}/answers")
async def reading_answers(request: Request, attempt_id: str):
    user_answers = await request.body()
    user_answers = json.loads(user_answers.decode())['answers']

    await database.initialize()
    attempt = await database.get_attempt(attempt_id=attempt_id)
    test_id = attempt["test_id"]

    with open(IELTS_DIR / "reading" / "answers" / f"{test_id}_answers.json", 'r', encoding='utf-8') as f:
        right_answers = json.load(f)

    score = 0
    detailed_results = []

    for question, right_raw in right_answers['answers'].items():
        user_val = str(user_answers.get(question, "")).strip().lower()

        if isinstance(right_raw, list):
            right_val_lower = [str(r).strip().lower() for r in right_raw]
            is_correct = user_val in right_val_lower
            correct_display = ", ".join(right_raw)
        else:
            right_val_lower = str(right_raw).strip().lower()
            is_correct = user_val == right_val_lower
            correct_display = right_raw

        if is_correct:
            score += 1

        detailed_results.append({
            "questionId": question,
            "userAnswer": user_answers.get(question, ""),
            "correctAnswer": correct_display,
            "isCorrect": is_correct
        })

    score_label = f"{score}/{len(right_answers['answers'])}"

    await database.submit_attempt(attempt_id=attempt_id, score_label=score_label)

    attempt = await database.get_attempt(attempt_id=attempt_id)

    await database.close()

    return JSONResponse({
      "attemptId": attempt["attempt_id"],
      "scoreLabel": score_label,
      "status": attempt["status"],
      "feedback": "Optional feedback",
      "detailedResults": detailed_results
    })


@router.get("/reading/{test_id}")
async def reading(test_id: str, authorization: str = Header(None)):
    logger.debug(test_id)
    try:
        is_part = "-" in test_id
        base_test_id = test_id.split("-")[0] if is_part else test_id
        PART_FILE_MAP = {
            f"{base_test_id}-part1": "r1",
            f"{base_test_id}-part2": "r2",
            f"{base_test_id}-part3": "r3",
        }

        PART_LABELS = ["Georgia O'Keeffe", "Adapting to the effects of climate change", "A new role for livestock guard dogs"]
        PART_IDS = [f"{base_test_id}-part1", f"{base_test_id}-part2", f"{base_test_id}-part3"]
        PART_FILES = ["r1", "r2", "r3"]

        if is_part:
            part_num = int(test_id.split("-")[1].replace("part", ""))
            file_id = PART_FILE_MAP.get(test_id, base_test_id)
        else:
            file_id = PART_FILES[0]

        await database.initialize()
        valid_user_id = await resolve_user_id(authorization)

        if not is_part:
            combined_parts = []
            for i, (pid, fid, label) in enumerate(zip(PART_IDS, PART_FILES, PART_LABELS), 1):
                with open(IELTS_DIR / "reading" / f"{fid}.json", 'r', encoding='utf-8') as f:
                    part_resp = json.load(f)
                part_data = part_resp['test'] if 'test' in part_resp else part_resp
                part_data['title'] = f"Cambridge IELTS 20 Test 1 — Reading Passage {i}"
                part_data['instruction'] = f"Part {i} of 3 · {label}"
                part_data['testId'] = pid
                combined_parts.append(part_data)

            test_data = combined_parts[0].copy()
            test_data['title'] = "Cambridge IELTS 20 Test 1 — Full Reading Test"
            test_data['instruction'] = "3 Passages · 40 Questions"
            test_data['durationSeconds'] = 3600
            test_data['isFullTest'] = True
            test_data['testId'] = test_id
            test_data['combinedParts'] = combined_parts

            attempt = AttemptModel(
                attempt_id=str(uuid4()),
                user_id=valid_user_id,
                mode="reading",
                test_id=test_id,
                test_title=test_data.get('title', f"Reading Test {test_id}")
            )
            attempt_id_row = await database.add_attempt(attempt=attempt)
            await database.close()
            test_data['attemptId'] = attempt_id_row[0] if attempt_id_row else "fallback-" + str(uuid4())
            return JSONResponse(test_data)

        with open(IELTS_DIR / "reading" / f"{file_id}.json", 'r', encoding='utf-8') as f:
            resp = json.load(f)

        test_data = resp['test'] if 'test' in resp else resp

        if is_part:
            part_num = int(test_id.split("-")[1].replace("part", ""))
            test_data['title'] = f"Cambridge IELTS 20 Test 1 — Reading Passage {part_num}"
            test_data['instruction'] = f"Part {part_num} of 3 · {PART_LABELS[part_num - 1]}"
            test_data['durationSeconds'] = 1200  # 20 min per passage
        test_data['testId'] = test_id

        attempt = AttemptModel(
            attempt_id=str(uuid4()),
            user_id=valid_user_id,
            mode="reading",
            test_id=file_id,  # store the file id so answers resolve correctly
            test_title=test_data.get('title', f"Reading Test {test_id}")
        )

        logger.info(attempt)

        attempt_id_row = await database.add_attempt(attempt=attempt)
        await database.close()

        if attempt_id_row:
            test_data['attemptId'] = attempt_id_row[0]
        else:
            test_data['attemptId'] = "fallback-" + str(uuid4())

        return JSONResponse(test_data)

    except Exception as ex:
        logger.error(ex)
        return JSONResponse({}, status_code=404)


@router.get("/writing/{test_id}")
async def writing(test_id: str, authorization: str = Header(None)):
    logger.debug(test_id)
    try:
        is_part = "-task" in test_id
        base_test_id = test_id.split("-")[0] if is_part else test_id

        test_data = load_mode_test("writing", base_test_id)
        test_data["testId"] = test_id

        if is_part:
            task_num = int(test_id.split("-task")[1])
            test_data["tasks"] = [test_data["tasks"][task_num - 1]]
            test_data["title"] = f"{test_data.get('title')} (Task {task_num})"
            test_data["durationSeconds"] = 1200 if task_num == 1 else 2400

        await database.initialize()
        valid_user_id = await resolve_user_id(authorization)

        attempt = AttemptModel(
            attempt_id=str(uuid4()),
            user_id=valid_user_id,
            mode="writing",
            test_id=test_id,
            test_title=test_data.get("title", f"Writing Test {test_id}")
        )

        attempt_id_row = await database.add_attempt(attempt=attempt)
        await database.close()

        test_data["attemptId"] = attempt_id_row[0] if attempt_id_row else f"fallback-{uuid4()}"
        return JSONResponse(test_data)

    except FileNotFoundError as ex:
        logger.warning(ex)
        return JSONResponse({"message": str(ex)}, status_code=404)
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({}, status_code=404)


@router.post("/writing/{attempt_id}/answers")
async def writing_answers(request: Request, attempt_id: str):
    try:
        payload = await request.body()
        answers = json.loads(payload.decode()).get("answers", {})
        answered_count = sum(1 for value in answers.values() if str(value).strip())

        await database.initialize()
        attempt = await database.get_attempt(attempt_id=attempt_id)
        if not attempt:
            await database.close()
            return JSONResponse({"message": "Attempt not found."}, status_code=404)

        test_id = attempt["test_id"]
        try:
            test_data = load_mode_test("writing", test_id)
        except Exception as e:
            logger.warning(f"Could not load test data for writing evaluation: {e}")
            test_data = {}

        evaluation_result = await evaluate_writing_with_gemini(answers, test_data)

        if evaluation_result and "overall_score" in evaluation_result:
            score_label = f"Band {evaluation_result['overall_score']}"
            status = "completed"
        else:
            score_label = f"Pending review ({answered_count} responses)"
            status = "checking"

        await database.submit_attempt(
            attempt_id=attempt_id,
            score_label=score_label,
            status=status
        )
        updated_attempt = await database.get_attempt(attempt_id=attempt_id)
        await database.close()

        return JSONResponse({
            "attemptId": attempt_id,
            "scoreLabel": score_label,
            "status": (updated_attempt["status"] if updated_attempt else status),
            "feedback": "Evaluation complete." if evaluation_result else "Writing responses were submitted and are waiting for review.",
            "detailedResults": evaluation_result
        })
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({"message": "Failed to submit writing answers."}, status_code=500)


@router.get("/speaking/{test_id}")
async def speaking(test_id: str, authorization: str = Header(None)):
    logger.debug(test_id)
    try:
        is_part = "-part" in test_id
        base_test_id = test_id.split("-")[0] if is_part else test_id

        test_data = load_mode_test("speaking", base_test_id)
        test_data["testId"] = test_id

        if is_part:
            part_num = int(test_id.split("-part")[1])
            test_data["tasks"] = [test_data["tasks"][part_num - 1]]
            test_data["title"] = f"{test_data.get('title')} (Part {part_num})"
            test_data["durationSeconds"] = 300 if part_num in [1, 3] else 240

        await database.initialize()
        valid_user_id = await resolve_user_id(authorization)

        attempt = AttemptModel(
            attempt_id=str(uuid4()),
            user_id=valid_user_id,
            mode="speaking",
            test_id=test_id,
            test_title=test_data.get("title", f"Speaking Test {test_id}")
        )

        attempt_id_row = await database.add_attempt(attempt=attempt)
        await database.close()

        test_data["attemptId"] = attempt_id_row[0] if attempt_id_row else f"fallback-{uuid4()}"
        return JSONResponse(test_data)

    except FileNotFoundError as ex:
        logger.warning(ex)
        return JSONResponse({"message": str(ex)}, status_code=404)
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({}, status_code=404)


@router.post("/speaking/{attempt_id}/answers")
async def speaking_answers(request: Request, attempt_id: str):
    try:
        payload = await request.body()
        answers = json.loads(payload.decode()).get("answers", {})
        answered_count = sum(1 for value in answers.values() if str(value).strip())

        await database.initialize()
        attempt = await database.get_attempt(attempt_id=attempt_id)
        if not attempt:
            await database.close()
            return JSONResponse({"message": "Attempt not found."}, status_code=404)

        test_id = attempt["test_id"]
        try:
            base_test_id = test_id.split("-")[0] if "-part" in test_id else test_id
            test_data = load_mode_test("speaking", base_test_id)
        except Exception as e:
            logger.warning(f"Could not load test data for speaking evaluation: {e}")
            test_data = {}

        evaluation_result = await evaluate_speaking_with_gemini(answers, test_data)

        if evaluation_result and "overall_score" in evaluation_result:
            score_label = f"Band {evaluation_result['overall_score']}"
            status = "completed"
        else:
            score_label = f"Pending review ({answered_count} responses)"
            status = "checking"

        await database.submit_attempt(
            attempt_id=attempt_id,
            score_label=score_label,
            status=status
        )
        updated_attempt = await database.get_attempt(attempt_id=attempt_id)
        await database.close()

        return JSONResponse({
            "attemptId": attempt_id,
            "scoreLabel": score_label,
            "status": (updated_attempt["status"] if updated_attempt else status),
            "feedback": "Evaluation complete." if evaluation_result else "Speaking responses were submitted and are waiting for review.",
            "detailedResults": evaluation_result
        })
    except Exception as ex:
        logger.error(ex)
        return JSONResponse({"message": "Failed to submit speaking answers."}, status_code=500)


@router.post("/listening/{attempt_id}/answers")
async def listening_answers(request: Request, attempt_id: str):
    user_answers = await request.body()
    user_answers = json.loads(user_answers.decode())['answers']

    await database.initialize()
    attempt = await database.get_attempt(attempt_id=attempt_id)
    test_id = attempt["test_id"]

    base_test_id, part_num = parse_part_test_id(test_id)
    is_part = part_num is not None

    part_answers_path = IELTS_DIR / "listening" / "answers" / f"{base_test_id}_part{part_num}_answers.json"
    full_answers_path = IELTS_DIR / "listening" / "answers" / f"{base_test_id}_answers.json"

    if is_part:
        if part_answers_path.exists():
            right_answers = load_json(part_answers_path)
            keys_to_grade = list(right_answers['answers'].keys())
        else:
            right_answers = load_json(full_answers_path)
            start_idx = (part_num - 1) * 10
            end_idx = start_idx + 10
            keys_to_grade = list(right_answers['answers'].keys())[start_idx:end_idx]
    else:
        right_answers = load_json(full_answers_path)
        keys_to_grade = list(right_answers['answers'].keys())

    score = 0
    detailed_results = []
    
    for question in keys_to_grade:
        user_val = str(user_answers.get(question, "")).strip().lower()
        right_raw = right_answers['answers'][question]
        if isinstance(right_raw, list):
            right_val_lower = [str(r).strip().lower() for r in right_raw]
            is_correct = user_val in right_val_lower
            correct_display = ", ".join(right_raw)
        else:
            right_val_lower = str(right_raw).strip().lower()
            is_correct = user_val == right_val_lower
            correct_display = right_raw

        if is_correct:
            score += 1

        detailed_results.append({
            "questionId": question,
            "userAnswer": user_answers.get(question, ""),
            "correctAnswer": correct_display,
            "isCorrect": is_correct
        })

    score_label = f"{score}/{len(keys_to_grade)}"

    await database.submit_attempt(attempt_id=attempt_id, score_label=score_label)

    attempt = await database.get_attempt(attempt_id=attempt_id)

    await database.close()

    return JSONResponse({
      "attemptId": attempt["attempt_id"],
      "scoreLabel": score_label,
      "status": attempt["status"],
      "feedback": "Optional feedback",
      "detailedResults": detailed_results
    })

@router.get("/listening/{test_id}")
async def listening(test_id: str, authorization: str = Header(None)):
    logger.debug(test_id)
    try:
        base_test_id, part_num = parse_part_test_id(test_id)
        is_part = part_num is not None
        part_file_path = IELTS_DIR / "listening" / f"{base_test_id}_part{part_num}.json"
        full_file_path = IELTS_DIR / "listening" / f"{base_test_id}.json"

        if is_part and part_file_path.exists():
            resp = load_json(part_file_path)
            test_data = resp['test'] if 'test' in resp else resp
            test_data['testId'] = test_id
        else:
            resp = load_json(full_file_path)
            test_data = resp['test'] if 'test' in resp else resp

            if is_part:
                start_idx = (part_num - 1) * 10
                end_idx = start_idx + 10
                test_data['questions'] = test_data['questions'][start_idx:end_idx]
                test_data['title'] = f"{test_data.get('title')} (Part {part_num})"
                test_data['durationSeconds'] = 600
                if isinstance(test_data.get("transcripts"), dict):
                    transcript = test_data["transcripts"].get(str(part_num))
                    test_data["transcripts"] = {str(part_num): transcript} if transcript else {}
                base_audio_dir = test_data.get('audioUrl', '').rsplit('/', 1)[0]
                test_data['audioUrl'] = f"{base_audio_dir}/part{part_num}.mp3"
            else:
                base_audio_dir = test_data.get('audioUrl', '').rsplit('/', 1)[0]
                test_data['partAudios'] = {
                    "1": f"{base_audio_dir}/part1.mp3",
                    "2": f"{base_audio_dir}/part2.mp3",
                    "3": f"{base_audio_dir}/part3.mp3",
                    "4": f"{base_audio_dir}/part4.mp3",
                }
                test_data['audioUrl'] = f"{base_audio_dir}/part1.mp3"
        test_data['testId'] = test_id

        await database.initialize()
        valid_user_id = await resolve_user_id(authorization)

        attempt = AttemptModel(
            attempt_id=str(uuid4()), 
            user_id=valid_user_id,
            mode="listening", 
            test_id=test_id, 
            test_title=test_data.get('title', f"Listening Test {test_id}")
        )

        logger.info(attempt)

        attempt_id_row = await database.add_attempt(attempt=attempt)
        await database.close()

        if attempt_id_row:
            test_data['attemptId'] = attempt_id_row[0]
        else:
            test_data['attemptId'] = "fallback-" + str(uuid4())

        return JSONResponse(test_data)

    except Exception as ex:
        logger.error(ex)
        return JSONResponse({}, status_code=404)
