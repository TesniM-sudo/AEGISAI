import sqlite3
from datetime import datetime

conn = sqlite3.connect("aegisai.db")
cursor = conn.cursor()

cursor.execute("SELECT symbol, MAX(date) FROM market_data GROUP BY symbol")
rows = cursor.fetchall()
for row in rows:
    print(row)

conn.close()
