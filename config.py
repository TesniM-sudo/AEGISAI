from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

CANDIDATE_DB_PATHS = [
    (BASE_DIR.parent / 'aegisai.db').resolve(),            # if Chatbot is inside AEGISAI-master
    (BASE_DIR.parent / 'AEGISAI-master' / 'aegisai.db').resolve(),
    (BASE_DIR.parent / 'work' / 'AEGISAI-master' / 'aegisai.db').resolve(),
]

DB_PATH = next((path for path in CANDIDATE_DB_PATHS if path.exists()), CANDIDATE_DB_PATHS[0])
DEFAULT_HISTORY_DAYS = 7
API_TITLE = 'AegisAI Chatbot MVP'
