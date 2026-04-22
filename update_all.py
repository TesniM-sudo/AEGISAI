"""AegisAI database refresh pipeline.

This script can be run directly (`python update_all.py`) and is also importable
by the FastAPI background updater (`services.auto_update_service`).
"""

from __future__ import annotations

import time
from datetime import date, timedelta

import pandas as pd
import yfinance as yf

from database import engine
from risk_engine import train_model


SYMBOLS = ["BTC-USD", "ETH-USD", "AAPL", "TSLA", "EURUSD=X"]


def _next_start_date(last_date: object) -> str:
    if pd.isna(last_date):
        return "2020-01-01"
    last_dt = pd.to_datetime(last_date).date()
    return (last_dt + timedelta(days=1)).isoformat()


def update_market_data() -> dict:
    print("\n[STEP 1] Updating market_data...")

    inserted_total = 0
    per_symbol: dict[str, int] = {}

    for symbol in SYMBOLS:
        try:
            result = pd.read_sql(
                f"SELECT MAX(date) as last_date FROM market_data WHERE symbol = '{symbol}'",
                engine,
            )
            last_date = result.iloc[0]["last_date"]
            start_date = _next_start_date(last_date)

            data = None
            for attempt in range(3):
                try:
                    data = yf.download(symbol, start=start_date, progress=False)
                    break
                except Exception:
                    time.sleep(1.5 * (2**attempt))

            if data is None or getattr(data, "empty", True):
                print(f"  {symbol}: Already up to date or unavailable.")
                per_symbol[symbol] = 0
                continue

            # Flatten MultiIndex columns (some yfinance responses include them)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            data.reset_index(inplace=True)

            # Standardize column names
            data.rename(
                columns={
                    "Date": "date",
                    "Close": "close",
                    "Open": "open",
                    "High": "high",
                    "Low": "low",
                    "Volume": "volume",
                },
                inplace=True,
            )
            data["symbol"] = symbol
            data = data[["date", "open", "high", "low", "close", "volume", "symbol"]]

            existing = pd.read_sql(
                f"SELECT date FROM market_data WHERE symbol='{symbol}'",
                engine,
            )
            existing_dates = set(existing["date"].astype(str))
            data["date"] = data["date"].astype(str)
            new_data = data[~data["date"].isin(existing_dates)]

            if new_data.empty:
                print(f"  {symbol}: 0 new rows inserted, {len(data)} skipped.")
                per_symbol[symbol] = 0
                continue

            new_data.to_sql("market_data", engine, if_exists="append", index=False)
            inserted = int(len(new_data))
            inserted_total += inserted
            per_symbol[symbol] = inserted
            print(f"  {symbol}: {inserted} new rows inserted.")
        except Exception as exc:
            print(f"  {symbol}: Error -> {exc}")
            per_symbol[symbol] = 0

    return {"inserted_total": inserted_total, "inserted_by_symbol": per_symbol}


def rebuild_features() -> dict:
    print("\n[STEP 2] Rebuilding market_data_features...")

    df = pd.read_sql("SELECT * FROM market_data", engine)
    if df.empty:
        print("  No market data found.")
        return {"rows": 0}

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["symbol", "date"])

    df["daily_return"] = df.groupby("symbol")["close"].pct_change()
    df["volatility_7d"] = df.groupby("symbol")["daily_return"].rolling(7).std().reset_index(0, drop=True)
    df["ma_7d"] = df.groupby("symbol")["close"].rolling(7).mean().reset_index(0, drop=True)
    df["ma_30d"] = df.groupby("symbol")["close"].rolling(30).mean().reset_index(0, drop=True)

    df.to_sql("market_data_features", engine, if_exists="replace", index=False)
    print(f"  market_data_features rebuilt: {len(df)} rows.")
    return {"rows": int(len(df))}


def rebuild_risk_predictions() -> dict:
    print("\n[STEP 3] Rebuilding market_risk_predictions...")
    model = train_model()
    if model is None:
        print("  [!] Model training failed.")
        return {"ok": False}

    print("  [OK] market_risk_predictions updated.")
    return {"ok": True}


def run_update_all() -> dict:
    """Run the full update pipeline and return a small summary."""
    started = date.today().isoformat()
    market = update_market_data()
    features = rebuild_features()
    risk = rebuild_risk_predictions()
    return {"started_date": started, "market": market, "features": features, "risk": risk}


if __name__ == "__main__":
    run_update_all()
    print("\n[OK] All steps completed successfully!")

