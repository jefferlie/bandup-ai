from fastapi.responses import JSONResponse
from fastapi import APIRouter

from loguru import logger
from pathlib import Path
from datetime import datetime
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

from core.config import DSN
from db.db_functions import Users_DB

router = APIRouter(
    tags=["Dashboard info"],
)

database = Users_DB(DSN)

def calculate_streak(attempts):
    if not attempts: return 0
    
    dates = sorted(list(set([a['submitted_at'].date() for a in attempts if a['submitted_at']])))
    if not dates: return 0
    
    streak = 1
    current_date = dates[-1]
    today = datetime.utcnow().date()
    if (today - current_date).days > 1:
        return 0
        
    for i in range(len(dates) - 2, -1, -1):
        if (current_date - dates[i]).days == 1:
            streak += 1
            current_date = dates[i]
        else:
            break
            
    return streak


def build_achievement(achievement_id, title, description, icon, current, target):
    numeric_current = round(current, 1) if isinstance(current, float) else int(current)
    return {
        "id": achievement_id,
        "title": title,
        "description": description,
        "icon": icon,
        "completed": current >= target,
        "progress": {
            "current": numeric_current,
            "target": target,
        },
    }


def build_achievements(stats, progress, mode_attempt_counts):
    skill_modes = ["listening", "reading", "writing", "speaking"]
    total_completed = stats["totalTestsCompleted"]
    current_streak = stats["currentLearningStreak"]
    average_band = stats["averageBandScore"]

    sections_started_count = sum(1 for mode in skill_modes if mode_attempt_counts.get(mode, 0) > 0)
    sections_consistent_count = sum(1 for mode in skill_modes if mode_attempt_counts.get(mode, 0) >= 3)
    skills_65_count = sum(1 for mode in skill_modes if progress.get(f"{mode}Score", 0) >= 6.5)

    return [
        build_achievement(
            "first_attempt",
            "First Steps",
            "Complete your first practice attempt",
            "rocket_launch",
            total_completed,
            1,
        ),
        build_achievement(
            "test_runner_5",
            "Test Runner",
            "Complete 5 practice tests",
            "directions_run",
            total_completed,
            5,
        ),
        build_achievement(
            "practice_veteran_15",
            "Practice Veteran",
            "Complete 15 practice tests",
            "military_tech",
            total_completed,
            15,
        ),
        build_achievement(
            "consistent_learner",
            "Consistent Learner",
            "Reach a 3-day study streak",
            "calendar_month",
            current_streak,
            3,
        ),
        build_achievement(
            "streak_master",
            "Streak Master",
            "Reach a 7-day study streak",
            "local_fire_department",
            current_streak,
            7,
        ),
        build_achievement(
            "streak_legend",
            "Streak Legend",
            "Reach a 14-day study streak",
            "workspace_premium",
            current_streak,
            14,
        ),
        build_achievement(
            "all_sections_started",
            "All Sections Started",
            "Complete at least 1 attempt in each IELTS section",
            "overview",
            sections_started_count,
            4,
        ),
        build_achievement(
            "all_sections_consistent",
            "All Sections Consistent",
            "Complete at least 3 attempts in each IELTS section",
            "hub",
            sections_consistent_count,
            4,
        ),
        build_achievement(
            "band_65_overall",
            "Band 6.5 Chaser",
            "Reach average band score 6.5",
            "trending_up",
            average_band,
            6.5,
        ),
        build_achievement(
            "band_7_overall",
            "Band 7 Hunter",
            "Reach average band score 7.0",
            "emoji_events",
            average_band,
            7.0,
        ),
        build_achievement(
            "all_skills_65",
            "Balanced Performer",
            "Reach 6.5+ in all four skills",
            "balance",
            skills_65_count,
            4,
        ),
    ]

def calculate_ielts_listening_band(correct: int) -> float:
    if correct >= 39: return 9.0
    if correct >= 37: return 8.5
    if correct >= 35: return 8.0
    if correct >= 32: return 7.5
    if correct >= 30: return 7.0
    if correct >= 26: return 6.5
    if correct >= 23: return 6.0
    if correct >= 18: return 5.5
    if correct >= 16: return 5.0
    if correct >= 13: return 4.5
    if correct >= 10: return 4.0
    if correct >= 8: return 3.5
    if correct >= 6: return 3.0
    if correct >= 4: return 2.5
    if correct >= 2: return 2.0
    return 0.0

def calculate_ielts_reading_band(correct: int) -> float:
    if correct >= 39: return 9.0
    if correct >= 37: return 8.5
    if correct >= 35: return 8.0
    if correct >= 33: return 7.5
    if correct >= 30: return 7.0
    if correct >= 27: return 6.5
    if correct >= 23: return 6.0
    if correct >= 19: return 5.5
    if correct >= 15: return 5.0
    if correct >= 13: return 4.5
    if correct >= 10: return 4.0
    if correct >= 8: return 3.5
    if correct >= 6: return 3.0
    if correct >= 4: return 2.5
    if correct >= 2: return 2.0
    return 0.0

@router.get("/api/dashboard")
async def dashboard(email: str = None):
    await database.initialize()
    stats = {
        "totalTestsCompleted": 0,
        "averageBandScore": 0,
        "currentLearningStreak": 0
    }
    progress = {
        "baselineScore": 5.5,
        "listeningScore": 0,
        "readingScore": 0,
        "writingScore": 0,
        "speakingScore": 0,
        "targetScore": 7.5
    }
    user_profile = {
        "targetBand": progress["targetScore"],
        "examDate": None,
    }
    mode_attempt_counts = {
        "listening": 0,
        "reading": 0,
        "writing": 0,
        "speaking": 0,
    }
    recent_activity = []
    
    if email:
        user = await database.get_user_from_email(email)
        if user:
            user_id = user['id']
            user_settings = await database.get_user_settings(
                user_id,
                user['full_name'],
                user['email'],
            )
            study_preferences = (
                user_settings.get("studyPreferences", {})
                if isinstance(user_settings, dict)
                else {}
            )
            target_band = study_preferences.get("targetBand")
            exam_date = study_preferences.get("examDate")
            if isinstance(target_band, (int, float)):
                progress["targetScore"] = round(float(target_band), 1)
                user_profile["targetBand"] = round(float(target_band), 1)
            if isinstance(exam_date, str) and exam_date:
                user_profile["examDate"] = exam_date

            attempts = await database.get_user_attempts(user_id)
            completed_attempts = [a for a in attempts if a['status'] == 'completed' or a['status'] == 'submitted']
            stats["totalTestsCompleted"] = len(completed_attempts)
            stats["currentLearningStreak"] = calculate_streak(completed_attempts)
            scores_by_mode = {'listening': [], 'reading': [], 'writing': [], 'speaking': []}
            total_score = 0
            score_count = 0
            
            for a in completed_attempts:
                if a['mode'] in mode_attempt_counts:
                    mode_attempt_counts[a['mode']] += 1

                band = None
                
                try:
                    if a['score_label']:
                        if '/' in a['score_label']:
                            score_parts = a['score_label'].split('/')
                            correct = int(float(score_parts[0]))
                            
                            if a['mode'] == 'listening':
                                band = calculate_ielts_listening_band(correct)
                            elif a['mode'] == 'reading':
                                band = calculate_ielts_reading_band(correct)
                            else:
                                total = float(score_parts[1])
                                percentage = correct / total if total > 0 else 0
                                band = min(9.0, max(0.0, round(percentage * 9.0 * 2) / 2))
                                
                        elif a['score_label'].startswith('Band '):
                            band = float(a['score_label'].replace('Band ', '').strip())
                            
                    if band is not None:
                        if a['mode'] in scores_by_mode:
                            scores_by_mode[a['mode']].append(band)
                            total_score += band
                            score_count += 1
                except Exception as e:
                    logger.error(f"Error parsing score {a['score_label']}: {e}")
            
            if score_count > 0:
                stats["averageBandScore"] = round(total_score / score_count, 1)
                
            for mode, scores in scores_by_mode.items():
                if scores:
                    progress[f"{mode}Score"] = round(sum(scores) / len(scores), 1)
            sorted_attempts = sorted([a for a in attempts if a['submitted_at']], key=lambda x: x['submitted_at'], reverse=True)
            
            for a in sorted_attempts[:5]:
                recent_activity.append({
                    "id": a['attempt_id'],
                    "testId": a['test_id'],
                    "type": a['mode'],
                    "title": a['test_title'] or f"{a['mode'].title()} Practice",
                    "timeLabel": a['submitted_at'].strftime("%b %d, %Y"),
                    "score": a['score_label'] or "Pending",
                    "status": "completed" if a['status'] in ['completed', 'submitted', 'reviewed', 'reviwed'] else "pending"
                })
                
    await database.close()

    achievements = build_achievements(stats, progress, mode_attempt_counts)

    return JSONResponse({
          "userProfile": user_profile,
          "stats": stats,
          "progress": progress,
          "recentActivity": recent_activity,
          "upcomingClasses": [],
          "achievements": achievements
        }
    )
