import yfinance as yf
import pandas as pd
from sqlalchemy.orm import sessionmaker
from database import engine, MarketData
from datetime import datetime, timedelta

Session = sessionmaker(bind=engine)
session = Session()

# Assets list
assets = [
    ("BTC-USD", "crypto"),
    ("ETH-USD", "crypto"),
    ("AAPL", "stock"),
    ("TSLA", "stock"),
    ("EURUSD=X", "forex")
]


def update_data(symbol, asset_type):
    # 1️⃣ Get last date in DB for this symbol
    last_entry = session.query(MarketData).filter(MarketData.symbol == symbol).order_by(MarketData.date.desc()).first()
    if last_entry:
        start_date = last_entry.date + timedelta(days=1)
    else:
        start_date = (datetime.now() - timedelta(days=365)).date()

    end_date = datetime.now().date()

    # ✅ Already up to date, no need to download
    if start_date >= end_date:
        print(f"{symbol}: Already up to date.")
        return

    # 2️⃣ Download new data
    data = yf.download(
        symbol,
        start=start_date.strftime("%Y-%m-%d"),
        end=end_date.strftime("%Y-%m-%d"),
        interval="1d",
        auto_adjust=True
    )

    if data.empty:
        print(f"{symbol}: No new data available.")
        return

    # Flatten columns in case of MultiIndex
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    data.reset_index(inplace=True)
    data.rename(columns={"Datetime": "Date"}, inplace=True)
    data["symbol"] = symbol
    data["asset_type"] = asset_type
    data.dropna(subset=["Open", "High", "Low", "Close"], inplace=True)

    # 3️⃣ Insert new rows (skip duplicates)
    inserted = 0
    skipped = 0

    for _, row in data.iterrows():
        date_val = row["Date"]
        if hasattr(date_val, "to_pydatetime"):
            date_val = date_val.to_pydatetime().date()
        elif hasattr(date_val, "date"):
            date_val = date_val.date()

        exists = session.query(MarketData).filter_by(symbol=symbol, date=date_val).first()
        if exists:
            skipped += 1
            continue

        record = MarketData(
            symbol=row["symbol"],
            date=date_val,
            open=float(row["Open"]),
            high=float(row["High"]),
            low=float(row["Low"]),
            close=float(row["Close"]),
            volume=float(row["Volume"]) if pd.notna(row["Volume"]) else 0.0,
            asset_type=row["asset_type"]
        )
        session.add(record)
        inserted += 1

    session.commit()
    print(f"{symbol}: {inserted} new rows inserted, {skipped} skipped.")


# 4️⃣ Run updates for all assets
for symbol, asset_type in assets:
    try:
        update_data(symbol, asset_type)
    except Exception as e:
        session.rollback()
        print(f"ERROR updating {symbol}: {e}")

print("Database update complete.")