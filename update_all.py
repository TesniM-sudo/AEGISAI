import pandas as pd
from database import engine
from risk_engine import train_model
import yfinance as yf


# ================================
# STEP 1: UPDATE market_data
# ================================
def update_market_data():
    print("\n📥 STEP 1: Updating market_data...")

    symbols = ["BTC-USD", "ETH-USD", "AAPL", "TSLA", "EURUSD=X"]

    for symbol in symbols:
        try:
            query = f"""
                SELECT MAX(date) as last_date
                FROM market_data
                WHERE symbol = '{symbol}'
            """
            result = pd.read_sql(query, engine)
            last_date = result.iloc[0]["last_date"]

            start_date = "2020-01-01" if pd.isna(last_date) else str(last_date)

            data = yf.download(symbol, start=start_date, progress=False)

            if data.empty:
                print(f"  {symbol}: Already up to date.")
                continue

            # 🔥 FIX 1: Flatten MultiIndex columns
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            data.reset_index(inplace=True)

            # 🔥 FIX 2: Standardize column names
            data.rename(columns={
                "Date": "date",
                "Close": "close",
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Volume": "volume"
            }, inplace=True)

            data["symbol"] = symbol

            # Keep only needed columns
            data = data[["date", "open", "high", "low", "close", "volume", "symbol"]]

            # Remove duplicates
            existing = pd.read_sql(
                f"SELECT date FROM market_data WHERE symbol='{symbol}'",
                engine
            )
            existing_dates = set(existing["date"].astype(str))
            data["date"] = data["date"].astype(str)

            new_data = data[~data["date"].isin(existing_dates)]

            if new_data.empty:
                print(f"  {symbol}: 0 new rows inserted, {len(data)} skipped.")
                continue

            new_data.to_sql("market_data", engine, if_exists="append", index=False)

            print(f"  {symbol}: {len(new_data)} new rows inserted.")

        except Exception as e:
            print(f"  {symbol}: Error -> {e}")


# ================================
# STEP 2: BUILD FEATURES
# ================================
def rebuild_features():
    print("\n⚙️  STEP 2: Rebuilding market_data_features...")

    df = pd.read_sql("SELECT * FROM market_data", engine)

    if df.empty:
        print("  No market data found.")
        return

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["symbol", "date"])

    # 🔥 FIX: use lowercase column names
    df["daily_return"] = df.groupby("symbol")["close"].pct_change()

    df["volatility_7d"] = (
        df.groupby("symbol")["daily_return"]
        .rolling(7).std()
        .reset_index(0, drop=True)
    )

    df["ma_7d"] = (
        df.groupby("symbol")["close"]
        .rolling(7).mean()
        .reset_index(0, drop=True)
    )

    df["ma_30d"] = (
        df.groupby("symbol")["close"]
        .rolling(30).mean()
        .reset_index(0, drop=True)
    )

    df.to_sql("market_data_features", engine, if_exists="replace", index=False)

    print(f"  market_data_features rebuilt: {len(df)} rows.")


# ================================
# STEP 3: TRAIN MODEL
# ================================
def rebuild_risk_predictions():
    print("\n🔮 STEP 3: Rebuilding market_risk_predictions...")

    model = train_model()

    if model is None:
        print("  ⚠️ Model training failed.")
        return

    print("  ✅ market_risk_predictions updated.")


# ================================
# MAIN
# ================================
if __name__ == "__main__":
    update_market_data()
    rebuild_features()
    rebuild_risk_predictions()

    print("\n🚀 All steps completed successfully!")