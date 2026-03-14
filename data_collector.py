import yfinance as yf
import pandas as pd
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.sqlite import insert
from database import engine, MarketData, Base

# Ensure table exists
Base.metadata.create_all(engine)

Session = sessionmaker(bind=engine)
session = Session()


def download_data(symbol, asset_type):
    data = yf.download(symbol, period="1y", interval="1d", auto_adjust=True)

    # Fix MultiIndex columns (yfinance sometimes returns them)
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    data.reset_index(inplace=True)

    # Normalize column names (yfinance can return 'Datetime' for intraday)
    data.rename(columns={"Datetime": "Date"}, inplace=True)

    data["symbol"] = symbol
    data["asset_type"] = asset_type

    # Keep only the columns we need
    data = data[["symbol", "Date", "Open", "High", "Low", "Close", "Volume", "asset_type"]]
    data.dropna(subset=["Open", "High", "Low", "Close"], inplace=True)

    return data


# Assets list
assets = [
    ("BTC-USD", "crypto"),
    ("ETH-USD", "crypto"),
    ("AAPL", "stock"),
    ("TSLA", "stock"),
    ("EURUSD=X", "forex"),
]

for symbol, asset_type in assets:
    try:
        df = download_data(symbol, asset_type)

        inserted = 0
        skipped = 0

        for _, row in df.iterrows():
            # Convert date safely across pandas versions
            date_val = row["Date"]
            if hasattr(date_val, "to_pydatetime"):
                date_val = date_val.to_pydatetime().date()
            elif hasattr(date_val, "date"):
                date_val = date_val.date()

            # Check for existing record to avoid duplicates
            exists = session.query(MarketData).filter_by(
                symbol=row["symbol"], date=date_val
            ).first()

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
                asset_type=row["asset_type"],
            )
            session.add(record)
            inserted += 1

        session.commit()
        print(f"{symbol}: {inserted} rows inserted, {skipped} skipped (already exist).")

    except Exception as e:
        session.rollback()
        print(f"ERROR processing {symbol}: {e}")

print("Data collection complete.")


