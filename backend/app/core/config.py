import os
from pathlib import Path

IS_ON_PROD = os.getenv("IS_ON_PROD", "false").lower() in ("true", "1", "yes")

BASE_URL = os.getenv("BASE_URL", "http://backend.bandup-ai.com" if IS_ON_PROD else "http://127.0.0.1:5000")
DSN = os.getenv("DATABASE_URL", "postgresql://fisuan:1337@localhost:5432/bandup_db")

_MATERIALS_DIR = Path(__file__).resolve().parents[3] / "materials"

IELTS_DB_PATH = Path(os.getenv("IELTS_DB_PATH", str(_MATERIALS_DIR / "ielts.db")))
SAT_DB_PATH = Path(os.getenv("SAT_DB_PATH", str(_MATERIALS_DIR / "sat.db")))

PROMO_CODE = os.getenv("PROMO_CODE", "bird-grain-ocean")
SAT_REQUIRES_SUBSCRIPTION = os.getenv("SAT_REQUIRES_SUBSCRIPTION", "false").lower() in ("true", "1", "yes")


class UserExistsException(Exception):
    def __init__(self, message: str, code: int = 1):
        super().__init__(f"User with email {message} is already exists!")
        self.code = code
