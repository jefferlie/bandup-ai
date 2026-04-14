from fastapi.responses import JSONResponse
from fastapi import APIRouter

from loguru import logger
from pathlib import Path
import sys
import json

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

CONFIGS_DIR = PROJECT_ROOT / 'app' / 'core' / 'configs'

router = APIRouter(
    prefix="/api/content",
    tags=["Dashboard info"],
)

@router.get("/home")
async def home():
    with open(CONFIGS_DIR / 'home_content.json', 'r', encoding='utf-8') as f:
        home_content = json.load(f)

    return JSONResponse(home_content)


@router.get("/ai-info")
async def ai_info():
    with open(CONFIGS_DIR / 'ai_info.json', 'r', encoding='utf-8') as f:
        aiInfo = json.load(f)

    return JSONResponse(aiInfo)

