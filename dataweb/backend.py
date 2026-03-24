from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from database import engine, MarketData, Base
import pandas as pd
import matplotlib.pyplot as plt
import io
import joblib

# ── App & Session ─────────────────────────────────────────────────────────────
Session = sessionmaker(bind=engine)
app = FastAPI(title="AegisAI Backend")  # only ONE app instance
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models once at startup
def load_model_if_exists(filename: str):
    model_path = Path(__file__).resolve().parent / filename
    if model_path.exists():
        return joblib.load(model_path)
    return None


model = load_model_if_exists("logistic_model.pkl")
iso_model = load_model_if_exists("isolation_model.pkl")


# ── Helper ────────────────────────────────────────────────────────────────────
def query_table(table_class, symbol=None):
    session = Session()
    query = session.query(table_class)
    if symbol:
        query = query.filter(table_class.symbol == symbol)
    df = pd.read_sql(query.statement, session.bind)
    session.close()
    return df.to_dict(orient="records")


# ── General ───────────────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "AegisAI is running"}


@app.get("/dashboard/assets")
def dashboard_assets(limit: int = 30):
    """Return live dashboard card data for each symbol."""
    with engine.connect() as conn:
        symbols = pd.read_sql(text("SELECT DISTINCT symbol FROM market_data ORDER BY symbol"), conn)
    if symbols.empty:
        return {"data": []}

    name_map = {
        "AAPL": "Apple",
        "TSLA": "Tesla",
        "BTC-USD": "Bitcoin",
        "ETH-USD": "Ethereum",
        "EURUSD=X": "EUR/USD",
    }
    color_map = {
        "AAPL": "hsl(192, 92%, 62%)",
        "TSLA": "hsl(350, 82%, 62%)",
        "BTC-USD": "hsl(38, 98%, 60%)",
        "ETH-USD": "hsl(268, 76%, 66%)",
        "EURUSD=X": "hsl(145, 72%, 52%)",
    }
    glow_map = {
        "AAPL": "neon-glow-btc",
        "TSLA": "neon-glow-dot",
        "BTC-USD": "neon-glow-ada",
        "ETH-USD": "neon-glow-sol",
        "EURUSD=X": "neon-glow-eth",
    }

    payload = []
    with engine.connect() as conn:
        for symbol in symbols["symbol"].tolist():
            price_df = pd.read_sql(
                text(
                    """
                    SELECT date, close
                    FROM market_data
                    WHERE symbol = :symbol
                    ORDER BY date DESC
                    LIMIT 2
                    """
                ),
                conn,
                params={"symbol": symbol},
            )
            spark_df = pd.read_sql(
                text(
                    """
                    SELECT close
                    FROM market_data
                    WHERE symbol = :symbol
                    ORDER BY date DESC
                    LIMIT :limit
                    """
                ),
                conn,
                params={"symbol": symbol, "limit": limit},
            )
            risk_df = pd.read_sql(
                text(
                    """
                    SELECT risk_flag, volatility_7d, daily_return
                    FROM market_risk_predictions
                    WHERE symbol = :symbol
                    ORDER BY date DESC
                    LIMIT 1
                    """
                ),
                conn,
                params={"symbol": symbol},
            )

            if price_df.empty:
                continue

            current_close = float(price_df.iloc[0]["close"])
            previous_close = float(price_df.iloc[1]["close"]) if len(price_df) > 1 else current_close
            pct_change = ((current_close - previous_close) / previous_close * 100) if previous_close else 0.0

            risk_flag = int(risk_df.iloc[0]["risk_flag"]) if not risk_df.empty and pd.notna(risk_df.iloc[0]["risk_flag"]) else 0
            volatility = float(risk_df.iloc[0]["volatility_7d"]) if not risk_df.empty and pd.notna(risk_df.iloc[0]["volatility_7d"]) else 0.03
            confidence = max(55, min(96, round(92 - volatility * 220 - risk_flag * 14)))

            payload.append(
                {
                    "symbol": symbol,
                    "name": name_map.get(symbol, symbol),
                    "price": current_close,
                    "change_pct": pct_change,
                    "spark_data": spark_df["close"].iloc[::-1].round(6).tolist(),
                    "risk_band": "High" if risk_flag == 1 else "Low to Medium",
                    "confidence": f"{confidence}%",
                    "outlook": "Elevated monitoring suggested due to volatility." if risk_flag == 1 else "Behavior is currently within expected market ranges.",
                    "portfolio_fit": "Tracked in project dataset",
                    "color": color_map.get(symbol, "hsl(192, 92%, 62%)"),
                    "glow_class": glow_map.get(symbol, "neon-glow-btc"),
                }
            )

    return {"data": payload}


@app.get("/dashboard/candles")
def dashboard_candles(symbol: str, limit: int = 60):
    with engine.connect() as conn:
        df = pd.read_sql(
            text(
                """
                SELECT date, open, high, low, close
                FROM market_data
                WHERE symbol = :symbol
                ORDER BY date DESC
                LIMIT :limit
                """
            ),
            conn,
            params={"symbol": symbol, "limit": limit},
        )

    if df.empty:
        raise HTTPException(status_code=404, detail="No candle data found for this symbol.")

    data = df.iloc[::-1].to_dict(orient="records")
    return {"data": data}


# ── Market Data ───────────────────────────────────────────────────────────────
@app.get("/get-data")
def get_data(symbol: str = None):
    data = query_table(MarketData, symbol)
    if not data:
        raise HTTPException(status_code=404, detail="Data not found")
    return {"data": data}


@app.get("/get-features")
def get_features(symbol: str = None):
    session = Session()
    df = pd.read_sql("SELECT * FROM market_data_features", session.bind)
    session.close()
    if symbol:
        df = df[df["symbol"] == symbol]
    if df.empty:
        raise HTTPException(status_code=404, detail="Features not found")
    return {"data": df.to_dict(orient="records")}


# ── Risk Endpoints ────────────────────────────────────────────────────────────
@app.get("/risk/latest")
def risk_latest(symbol: str):
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT * FROM market_risk_predictions
                WHERE symbol = :symbol
                ORDER BY date DESC
                LIMIT 1
            """),
            conn,
            params={"symbol": symbol},
        )
    if df.empty:
        raise HTTPException(status_code=404, detail="No risk prediction found for this symbol.")
    return {"data": df.to_dict(orient="records")[0]}


@app.get("/risk/history")
def risk_history(symbol: str, limit: int = 200):
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT * FROM market_risk_predictions
                WHERE symbol = :symbol
                ORDER BY date DESC
                LIMIT :limit
            """),
            conn,
            params={"symbol": symbol, "limit": limit},
        )
    if df.empty:
        raise HTTPException(status_code=404, detail="No risk history found for this symbol.")
    return {"data": df.to_dict(orient="records")}


@app.get("/risk/all")
def risk_all():
    """Return the latest risk prediction for every symbol."""
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT * FROM market_risk_predictions
                WHERE (symbol, date) IN (
                    SELECT symbol, MAX(date)
                    FROM market_risk_predictions
                    GROUP BY symbol
                )
                ORDER BY symbol
            """),
            conn,
        )
    if df.empty:
        raise HTTPException(status_code=404, detail="No risk data available.")
    return {"data": df.to_dict(orient="records")}


@app.get("/risk/summary")
def risk_summary(symbol: str):
    """Return avg, min, max risk score for a symbol."""
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT
                    symbol,
                    COUNT(*)        AS total_records,
                    AVG(risk_flag) AS avg_risk,
                    MIN(risk_flag) AS min_risk,
                    MAX(risk_flag) AS max_risk
                FROM market_risk_predictions
                WHERE symbol = :symbol
                GROUP BY symbol
            """),
            conn,
            params={"symbol": symbol},
        )
    if df.empty:
        raise HTTPException(status_code=404, detail="No summary found for this symbol.")
    return {"summary": df.to_dict(orient="records")[0]}


# ── Predict (ML models) ───────────────────────────────────────────────────────
@app.post("/predict")
def predict(data: dict):
    if model is None or iso_model is None:
        raise HTTPException(
            status_code=503,
            detail="Prediction models are unavailable. Add logistic_model.pkl and isolation_model.pkl to enable this endpoint.",
        )

    try:
        features = [
            data["amount"],
            data["transactions_per_day"],
            data["account_age_days"]
        ]
    except KeyError as e:
        raise HTTPException(status_code=422, detail=f"Missing field: {e}")

    risk = model.predict([features])[0]
    anomaly = iso_model.predict([features])[0]

    return {
        "risk_prediction": int(risk),
        "anomaly_detection": int(anomaly)
    }


# ── Graphs ────────────────────────────────────────────────────────────────────
@app.get("/graph/price")
def price_graph(symbol: str):
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT date, close FROM market_data
                WHERE symbol = :symbol
                ORDER BY date ASC
            """),
            conn,
            params={"symbol": symbol},
        )
    if df.empty:
        raise HTTPException(status_code=404, detail="No price data found for this symbol.")

    df["date"] = pd.to_datetime(df["date"])
    plt.figure()
    plt.plot(df["date"], df["close"])
    plt.title(f"{symbol} Close Price")
    plt.xlabel("Date")
    plt.ylabel("Close Price")
    plt.xticks(rotation=45)
    plt.tight_layout()

    buffer = io.BytesIO()
    plt.savefig(buffer, format="png")
    buffer.seek(0)
    plt.close()
    return StreamingResponse(buffer, media_type="image/png")


@app.get("/graph/risk")
def risk_graph(symbol: str, limit: int = 200):
    """Plot risk score over time for a symbol."""
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT date, risk_flag FROM market_risk_predictions
                WHERE symbol = :symbol
                ORDER BY date ASC
                LIMIT :limit
            """),
            conn,
            params={"symbol": symbol, "limit": limit},
        )
    if df.empty:
        raise HTTPException(status_code=404, detail="No risk data found for this symbol.")

    df["date"] = pd.to_datetime(df["date"])
    plt.figure()
    plt.plot(df["date"], df["risk_flag"], color="red")
    plt.title(f"{symbol} Risk Score Over Time")
    plt.xlabel("Date")
    plt.ylabel("Risk Flag")
    plt.xticks(rotation=45)
    plt.tight_layout()

    buffer = io.BytesIO()
    plt.savefig(buffer, format="png")
    buffer.seek(0)
    plt.close()
    return StreamingResponse(buffer, media_type="image/png")
