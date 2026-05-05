from __future__ import annotations

import sqlite3

from config import DB_PATH


conn = sqlite3.connect(str(DB_PATH))
cursor = conn.cursor()

try:
    cursor.execute("SELECT symbol, MAX(date) FROM market_data GROUP BY symbol")
    rows = cursor.fetchall()
    for row in rows:
        print(row)
finally:
    conn.close()
