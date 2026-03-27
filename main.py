from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from database import engine, MarketData, Base
import pandas as pd
import matplotlib.pyplot as plt
import io

# Chatbot imports
from config import API_TITLE
from finance_assistant import FinanceAssistant
from schemas import ChatRequest, ChatResponse

# ML imports
from ml_models import predict_risk, predict_anomaly

# ── App & Session ────────────────────────────────────────────────────────────
Session = sessionmaker(bind=engine)
app = FastAPI(title="AegisAI")
assistant = FinanceAssistant()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helper ───────────────────────────────────────────────────────────────────
def query_table(table_class, symbol=None):
    session = Session()
    query = session.query(table_class)
    if symbol:
        query = query.filter(table_class.symbol == symbol)
    df = pd.read_sql(query.statement, session.bind)
    session.close()
    return df.to_dict(orient="records")

# ── General ──────────────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "AegisAI is running"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": API_TITLE,
        "supported_symbols": len(assistant.available_symbols),
    }

# ── Chatbot ──────────────────────────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    reply, intent, symbols, structured = assistant.handle_message(request.message)
    return ChatResponse(
        reply=reply,
        intent=intent,
        symbols=symbols,
        structured_data=structured,
    )

# ── Market Data ──────────────────────────────────────────────────────────────
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

# ── Risk Endpoints ───────────────────────────────────────────────────────────
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
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT
                    symbol,
                    COUNT(*)        AS total_records,
                    AVG(risk_score) AS avg_risk,
                    MIN(risk_score) AS min_risk,
                    MAX(risk_score) AS max_risk
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

# ── Predict (ML models) ──────────────────────────────────────────────────────
@app.post("/predict")
def predict(data: dict):
    try:
        features = [
            data["amount"],
            data["transactions_per_day"],
            data["account_age_days"]
        ]
    except KeyError as e:
        raise HTTPException(status_code=422, detail=f"Missing field: {e}")

    risk = predict_risk(features)
    anomaly = predict_anomaly(features)

    return {
        "risk_prediction": risk,
        "anomaly_detection": anomaly
    }

# ── Graphs ───────────────────────────────────────────────────────────────────
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
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT date, risk_score FROM market_risk_predictions
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
    plt.plot(df["date"], df["risk_score"], color="red")
    plt.title(f"{symbol} Risk Score Over Time")
    plt.xlabel("Date")
    plt.ylabel("Risk Score")
    plt.xticks(rotation=45)
    plt.tight_layout()

    buffer = io.BytesIO()
    plt.savefig(buffer, format="png")
    buffer.seek(0)
    plt.close()
    return StreamingResponse(buffer, media_type="image/png")
# ── Dashboard Endpoints ──────────────────────────────────────────────────────
@app.get("/dashboard/assets")
def dashboard_assets():
    SYMBOL_META = {
        "BTC-USD":  {"name": "Bitcoin",   "color": "#f7931a", "glow_class": "glow-orange"},
        "ETH-USD":  {"name": "Ethereum",  "color": "#627eea", "glow_class": "glow-purple"},
        "AAPL":     {"name": "Apple",     "color": "#00d4aa", "glow_class": "glow-green"},
        "TSLA":     {"name": "Tesla",     "color": "#e31937", "glow_class": "glow-red"},
        "EURUSD=X": {"name": "EUR/USD",   "color": "#00b4d8", "glow_class": "glow-blue"},
    }
    assets = []
    with engine.connect() as conn:
        for symbol, meta in SYMBOL_META.items():
            # latest price
            df = pd.read_sql(text("""
                SELECT close, date FROM market_data
                WHERE symbol = :symbol ORDER BY date DESC LIMIT 2
            """), conn, params={"symbol": symbol})
            if df.empty:
                continue
            latest_close = float(df.iloc[0]["close"])
            prev_close = float(df.iloc[1]["close"]) if len(df) > 1 else latest_close
            change_pct = ((latest_close - prev_close) / prev_close) * 100 if prev_close else 0

            # spark data (last 14 days)
            spark_df = pd.read_sql(text("""
                SELECT close FROM market_data
                WHERE symbol = :symbol ORDER BY date DESC LIMIT 14
            """), conn, params={"symbol": symbol})
            spark_data = list(reversed([float(x) for x in spark_df["close"].tolist()]))

            # risk
            risk_df = pd.read_sql(text("""
                SELECT risk_flag FROM market_risk_predictions
                WHERE symbol = :symbol ORDER BY date DESC LIMIT 1
            """), conn, params={"symbol": symbol})
            risk_flag = int(risk_df.iloc[0]["risk_flag"]) if not risk_df.empty else 0
            risk_band = "High" if risk_flag == 1 else "Low"

            assets.append({
                "symbol": symbol,
                "name": meta["name"],
                "portfolio_fit": "Tracked in project dataset",
                "price": latest_close,
                "change_pct": round(change_pct, 2),
                "spark_data": spark_data,
                "color": meta["color"],
                "glow_class": meta["glow_class"],
                "outlook": "Bullish" if change_pct >= 0 else "Bearish",
                "risk_band": risk_band,
                "confidence": f"{min(99, max(60, round(abs(change_pct) * 10 + 70)))}%",
            })
    return {"data": assets}


@app.get("/dashboard/candles")
def dashboard_candles(symbol: str, limit: int = 60):
    with engine.connect() as conn:
        df = pd.read_sql(text("""
            SELECT date, open, high, low, close FROM market_data
            WHERE symbol = :symbol ORDER BY date DESC LIMIT :limit
        """), conn, params={"symbol": symbol, "limit": limit})
    if df.empty:
        raise HTTPException(status_code=404, detail="No candle data found.")
    df = df.iloc[::-1].reset_index(drop=True)
    return {"data": df.to_dict(orient="records")}