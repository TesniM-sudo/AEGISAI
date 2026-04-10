from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from database import engine, MarketData, Base
import pandas as pd
import matplotlib.pyplot as plt
import io
import math

# Chatbot
from finance_assistant import FinanceAssistant
from schemas import ChatRequest, ChatResponse

# ML imports
from ml_models import predict_risk, predict_anomaly

# ── App Initialization ─────────────────────────────────────────────────────────
app = FastAPI(title="AegisAI Backend")  # single FastAPI instance

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB Session ────────────────────────────────────────────────────────────────
Session = sessionmaker(bind=engine)
assistant = FinanceAssistant()  # chatbot instance

# ── Helper Function ───────────────────────────────────────────────────────────
def sanitize_records(records):
    cleaned = []
    for record in records:
        cleaned.append({
            key: (None if isinstance(value, float) and not math.isfinite(value) else value)
            for key, value in record.items()
        })
    return cleaned


def query_table(table_class, symbol=None):
    with Session() as session:
        query = session.query(table_class)
        if symbol:
            query = query.filter(table_class.symbol == symbol)
        df = pd.read_sql(query.statement, session.bind)
    return sanitize_records(df.to_dict(orient="records"))

# ── General Endpoints ─────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "AegisAI is running"}

# ── Chatbot Endpoint ──────────────────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    reply, intent, symbols, structured = assistant.handle_message(request.message)
    return ChatResponse(
        reply=reply,
        intent=intent,
        symbols=symbols,
        structured_data=structured
    )

# ── Market Data Endpoints ─────────────────────────────────────────────────────
@app.get("/get-data")
def get_data(symbol: str = None):
    data = query_table(MarketData, symbol)
    if not data:
        raise HTTPException(status_code=404, detail="Data not found")
    return {"data": data}

@app.get("/get-features")
def get_features(symbol: str = None):
    with Session() as session:
        df = pd.read_sql("SELECT * FROM market_data_features", session.bind)
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

# ── Predict (ML models) ───────────────────────────────────────────────────────
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

# ── Graph Endpoints ──────────────────────────────────────────────────────────
@app.get("/graph/price")
def price_graph(symbol: str):
    with engine.connect() as conn:
        df = pd.read_sql(
            text("SELECT date, close FROM market_data WHERE symbol = :symbol ORDER BY date ASC"),
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
            text("SELECT date, risk_score FROM market_risk_predictions WHERE symbol = :symbol ORDER BY date ASC LIMIT :limit"),
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
