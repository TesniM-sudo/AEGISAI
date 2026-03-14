import sqlite3
import pandas as pd

conn = sqlite3.connect("aegisai.db")
df = pd.read_sql("SELECT * FROM market_data ORDER BY asset_type, symbol, date", conn)
conn.close()

with pd.ExcelWriter("market_data.xlsx", engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name="All Data", index=False)
    for asset_type, group in df.groupby("asset_type"):
        group.to_excel(writer, sheet_name=asset_type.capitalize(), index=False)

print("Done! market_data.xlsx created.")