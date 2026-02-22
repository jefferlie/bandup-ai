from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime, date

class Login_User(BaseModel):
    email: EmailStr
    password: str

class RegisterOnboarding(BaseModel):
    primaryExam: Literal["ielts", "sat"] = "ielts"
    targetIeltsScore: float | None = None
    currentIeltsScore: float | None = None
    targetExamDate: date | None = None
    targetSatScore: int | None = None
    studyHoursPerWeek: int = 6
    focusSkills: list[Literal["listening", "reading", "writing", "speaking"]] = []
    preferredStudyTime: Literal["morning", "afternoon", "evening", "flexible"] = "flexible"
    discoverySource: Literal[
        "instagram",
        "youtube",
        "tiktok",
        "friend",
        "google",
        "school",
        "other",
    ] = "other"

class Register_User(BaseModel):
    name: str
    email: EmailStr
    password: str
    onboarding: RegisterOnboarding | None = None
    
class UserModel(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = 'student'
    is_admin: bool = False
    created_at: datetime


class AttemptModel(BaseModel):
    attempt_id: str
    user_id: int
    mode: Literal['reading', 'listening', 'speaking', 'writing']
    test_id: str
    test_title: str
    submitted_at: datetime | None = None
    score_label: str | None = None
    status: Literal['submitted', 'reviwed'] | None = None
