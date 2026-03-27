from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'aegisai.db'
DEFAULT_HISTORY_DAYS = 7
API_TITLE = 'AegisAI Chatbot MVP'
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GROQ_MODEL = 'llama-3.3-70b-versatile'
