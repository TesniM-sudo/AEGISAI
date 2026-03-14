"""
update_all.py
Run this script every day to keep all 3 tables up to date:
  1. market_data             ← fetches new prices from Yahoo Finance
  2. market_data_features    ← recalculates features
  3. market_risk_predictions ← recalculates risk scores
"""

import yfinance as yf
import pandas as pd
from sqlalchemy.orm import sessionmaker
from database import engine, MarketData, Base
from risk_engine import train_model
from datetime import datetime, timedelta

Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
session = Session()

assets = [
    ("BTC-USD", "crypto"),
    ("ETH-USD", "crypto"),
    ("AAPL",    "stock"),
    ("TSLA",    "stock"),
    ("EURUSD=X","forex"),
]

# ─────────────────────────────────────────────
# STEP 1 — Update market_data
# ─────────────────────────────────────────────
print("\n📥 STEP 1: Updating market_data...")

def update_market_data(symbol, asset_type):
    last_entry = session.query(MarketData).filter(
        MarketData.symbol == symbol
    ).order_by(MarketData.date.desc()).first()

    start_date = (last_entry.date + timedelta(days=1)) if last_entry else (datetime.now() - timedelta(days=365)).date()
    end_date   = datetime.now().date()

    if start_date >= end_date:
        print(f"  {symbol}: Already up to date.")
        return

    data = yf.download(symbol, start=start_date.strftime("%Y-%m-%d"),
                       end=end_date.strftime("%Y-%m-%d"), interval="1d", auto_adjust=True)

    if data.empty:
        print(f"  {symbol}: No new data available.")
        return

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    data.reset_index(inplace=True)
    data.rename(columns={"Datetime": "Date"}, inplace=True)
    data["symbol"]     = symbol
    data["asset_type"] = asset_type
    data.dropna(subset=["Open", "High", "Low", "Close"], inplace=True)

    inserted = skipped = 0
    for _, row in data.iterrows():
        date_val = row["Date"]
        date_val = date_val.to_pydatetime().date() if hasattr(date_val, "to_pydatetime") else date_val.date()

        if session.query(MarketData).filter_by(symbol=symbol, date=date_val).first():
            skipped += 1
            continue

        session.add(MarketData(
            symbol=symbol, date=date_val,
            open=float(row["Open"]),   high=float(row["High"]),
            low=float(row["Low"]),     close=float(row["Close"]),
            volume=float(row["Volume"]) if pd.notna(row["Volume"]) else 0.0,
            asset_type=asset_type,
        ))
        inserted += 1

    session.commit()
    print(f"  {symbol}: {inserted} new rows inserted, {skipped} skipped.")

for symbol, asset_type in assets:
    try:
        update_market_data(symbol, asset_type)
    except Exception as e:
        session.rollback()
        print(f"  ERROR updating {symbol}: {e}")


# ─────────────────────────────────────────────
# STEP 2 — Rebuild market_data_features
# ─────────────────────────────────────────────
print("\n⚙️  STEP 2: Rebuilding market_data_features...")

df = pd.read_sql(session.query(MarketData).statement, session.bind)
df = df.sort_values(by=["symbol", "date"])

features = []
for symbol, group in df.groupby("symbol"):
    group = group.copy()
    group["daily_return"]  = group["close"].pct_change()
    group["volatility_7d"] = group["daily_return"].rolling(7).std()
    group["ma_7d"]         = group["close"].rolling(7).mean()
    group["ma_30d"]        = group["close"].rolling(30).mean()
    features.append(group)

df_features = pd.concat(features)
df_features.to_sql("market_data_features", con=engine, if_exists="replace", index=False)
print(f"  market_data_features rebuilt: {len(df_features)} rows.")


# ─────────────────────────────────────────────
# STEP 3 — Rebuild market_risk_predictions
# ─────────────────────────────────────────────
print("\n🔮 STEP 3: Rebuilding market_risk_predictions...")

df_feat   = pd.read_sql("SELECT * FROM market_data_features", engine)
feat_cols = df_feat[["daily_return", "volatility_7d"]].dropna()

model          = train_model(feat_cols)
df_risk        = df_feat.loc[feat_cols.index].copy()
df_risk["anomaly"]   = model.predict(feat_cols)
df_risk["risk_flag"] = df_risk["anomaly"].apply(lambda x: 1 if x == -1 else 0)

df_risk.to_sql("market_risk_predictions", engine, if_exists="replace", index=False)
print(f"  market_risk_predictions rebuilt: {len(df_risk)} rows.")


# ─────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────
print("\n✅ All tables updated successfully!")
print(f"   Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")