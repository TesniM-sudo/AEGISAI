from __future__ import annotations

import sqlite3

from config import DB_PATH


conn = sqlite3.connect(str(DB_PATH))

try:
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    print("Tables:", tables)
finally:
    conn.close()
