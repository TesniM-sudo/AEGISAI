from fastapi import FastAPI, HTTPException
from sqlalchemy.orm import sessionmaker
from database import engine, MarketData, Base
import pandas as pd
from sqlalchemy import text
from fastapi.responses import StreamingResponse
import matplotlib.pyplot as plt
import io
from sqlalchemy import text


Session = sessionmaker(bind=engine)
app = FastAPI(title="AegisAI Backend")

# Helper function to query DB and convert to dict
def query_table(table_class, symbol=None):
    session = Session()
    query = session.query(table_class)
    if symbol:
        query = query.filter(table_class.symbol == symbol)
    df = pd.read_sql(query.statement, session.bind)
    session.close()
    return df.to_dict(orient="records")

# Endpoint: get raw data
@app.get("/get-data")
def get_data(symbol: str = None):
    data = query_table(MarketData, symbol)
    if not data:
        raise HTTPException(status_code=404, detail="Data not found")
    return {"data": data}

# Endpoint: get feature-engineered data
@app.get("/get-features")
def get_features(symbol: str = None):
    session = Session()
    df = pd.read_sql("SELECT * FROM market_data_features", session.bind)
    session.close()
    if symbol:
        df = df[df["symbol"] == symbol]
    if df.empty:
        raise HTTPException(status_code=404, detail="Data not found")
    return {"data": df.to_dict(orient="records")}


# Endpoint: latest risk row for a symbol
@app.get("/risk/latest")
def risk_latest(symbol: str):
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT *
                FROM market_risk_predictions
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


# Endpoint: risk history for a symbol (most recent N rows)
@app.get("/risk/history")
def risk_history(symbol: str, limit: int = 200):
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT *
                FROM market_risk_predictions
                WHERE symbol = :symbol
                ORDER BY date DESC
                LIMIT :limit
            """),
            conn,
            params={"symbol": symbol, "limit": limit},
        )

    if df.empty:
        raise HTTPException(status_code=404, detail="No risk prediction found for this symbol.")
    return {"data": df.to_dict(orient="records")}

@app.get("/graph/price")
def price_graph(symbol: str):
    with engine.connect() as conn:
        df = pd.read_sql(
            text("""
                SELECT date, close
                FROM market_data
                WHERE symbol = :symbol
                ORDER BY date ASC
            """),
            conn,
            params={"symbol": symbol},
        )

    if df.empty:
        raise HTTPException(status_code=404, detail="No data found for this symbol.")

    df["date"] = pd.to_datetime(df["date"])

    # Create plot (single clean plot, no custom colors)
    plt.figure()
    plt.plot(df["date"], df["close"])
    plt.title(f"{symbol} Close Price")
    plt.xlabel("Date")
    plt.ylabel("Close Price")
    plt.xticks(rotation=45)
    plt.tight_layout()

    # Save to memory buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format="png")
    buffer.seek(0)
    plt.close()

    return StreamingResponse(buffer, media_type="image/png")