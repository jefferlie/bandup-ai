from google import genai

from dotenv import load_dotenv
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.append(str(PROJECT_ROOT))

print(PROJECT_ROOT)

load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=False)

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-flash-preview", contents="Explain how AI works in a few words"
)
print(response.text)
