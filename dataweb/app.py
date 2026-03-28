import json
import sqlite3
from pathlib import Path
from typing import List, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import API_TITLE
from finance_assistant import FinanceAssistant
from schemas import ChatRequest, ChatResponse

DB_PATH = Path(__file__).resolve().parent / "aegisai.db"
DEFAULT_ADMIN_EMAIL = "admin@aegisai.com"
DEFAULT_ADMIN_PASSWORD = "admin123"
Role = Literal["admin", "user"]
ASSET_COLORS = ["#22d3ee", "#8b7cff", "#fbbf24", "#34d399", "#f472b6", "#60a5fa", "#f97316", "#a3e635"]
ASSET_GLOWS = [
    "shadow-[0_0_32px_-18px_rgba(34,211,238,0.65)]",
    "shadow-[0_0_32px_-18px_rgba(139,124,255,0.65)]",
    "shadow-[0_0_32px_-18px_rgba(251,191,36,0.6)]",
    "shadow-[0_0_32px_-18px_rgba(52,211,153,0.6)]",
]

app = FastAPI(title=API_TITLE)
assistant = FinanceAssistant()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AccountAuthRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)


class AccountSession(BaseModel):
    email: str
    role: Role


class Holding(BaseModel):
    symbol: str
    name: str
    quantity: float
    avgPrice: float


class PortfolioState(BaseModel):
    startingCash: float
    cash: float
    holdings: List[Holding] = Field(default_factory=list)


class AccountStateResponse(BaseModel):
    session: AccountSession
    portfolio: PortfolioState


class SavePortfolioRequest(BaseModel):
    email: str
    portfolio: PortfolioState


def get_starting_cash(role: Role) -> float:
    return 100000.0 if role == "admin" else 10000.0


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def band_from_volatility(volatility: float | None) -> str:
    if volatility is None:
        return "Moderate"
    if volatility >= 0.045:
        return "High"
    if volatility >= 0.02:
        return "Medium"
    return "Low"


def confidence_from_risk(risk_flag: int | None) -> str:
    if risk_flag is None:
        return "72%"
    return "78%" if int(risk_flag) == 0 else "62%"


def portfolio_fit_from_risk(risk_flag: int | None) -> str:
    if risk_flag is None:
        return "Balanced"
    return "Core" if int(risk_flag) == 0 else "Watchlist"


def init_account_tables() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS account_users (
                email TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS account_portfolios (
                email TEXT PRIMARY KEY,
                starting_cash REAL NOT NULL,
                cash REAL NOT NULL,
                holdings_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (email) REFERENCES account_users(email) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO account_users (email, password, role)
            VALUES (?, ?, 'admin')
            """,
            (DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD),
        )


def row_to_portfolio(row: sqlite3.Row) -> PortfolioState:
    holdings_raw = row["holdings_json"] or "[]"
    try:
        holdings = json.loads(holdings_raw)
    except json.JSONDecodeError:
        holdings = []

    return PortfolioState(
        startingCash=float(row["starting_cash"]),
        cash=float(row["cash"]),
        holdings=holdings,
    )


def get_or_create_portfolio(conn: sqlite3.Connection, email: str, role: Role) -> PortfolioState:
    row = conn.execute(
        "SELECT starting_cash, cash, holdings_json FROM account_portfolios WHERE email = ?",
        (email,),
    ).fetchone()
    if row:
        return row_to_portfolio(row)

    starting_cash = get_starting_cash(role)
    conn.execute(
        """
        INSERT INTO account_portfolios (email, starting_cash, cash, holdings_json)
        VALUES (?, ?, ?, '[]')
        """,
        (email, starting_cash, starting_cash),
    )
    return PortfolioState(startingCash=starting_cash, cash=starting_cash, holdings=[])


@app.on_event("startup")
def startup_event() -> None:
    init_account_tables()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": API_TITLE,
        "supported_symbols": len(assistant.available_symbols),
    }


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    reply, intent, symbols, structured = assistant.handle_message(request.message)
    return ChatResponse(
        reply=reply,
        intent=intent,
        symbols=symbols,
        structured_data=structured,
    )


@app.get("/dashboard/assets")
def dashboard_assets(limit: int = 12):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
                m.symbol,
                m.close AS price,
                m.asset_type,
                (
                    SELECT p.close
                    FROM market_data p
                    WHERE p.symbol = m.symbol AND p.date < m.date
                    ORDER BY p.date DESC
                    LIMIT 1
                ) AS prev_close
            FROM market_data m
            WHERE m.date = (
                SELECT MAX(mm.date) FROM market_data mm WHERE mm.symbol = m.symbol
            )
            ORDER BY m.symbol
            LIMIT ?
            """,
            (max(1, min(limit, 40)),),
        ).fetchall()

        if not rows:
            return {"data": []}

        data = []
        for idx, row in enumerate(rows):
            symbol = row["symbol"]
            price = float(row["price"])
            prev_close = row["prev_close"]
            if prev_close in (None, 0):
                change_pct = 0.0
            else:
                change_pct = ((price - float(prev_close)) / float(prev_close)) * 100

            spark_rows = conn.execute(
                """
                SELECT close
                FROM market_data
                WHERE symbol = ?
                ORDER BY date DESC
                LIMIT 30
                """,
                (symbol,),
            ).fetchall()
            spark_data = [float(r["close"]) for r in reversed(spark_rows)]
            if len(spark_data) < 2:
                spark_data = [price, price]

            risk_row = conn.execute(
                """
                SELECT risk_flag, volatility_7d
                FROM market_risk_predictions
                WHERE symbol = ?
                ORDER BY date DESC
                LIMIT 1
                """,
                (symbol,),
            ).fetchone()
            risk_flag = None if not risk_row else risk_row["risk_flag"]
            volatility = None if not risk_row else risk_row["volatility_7d"]

            risk_band = band_from_volatility(float(volatility)) if volatility is not None else "Moderate"
            confidence = confidence_from_risk(risk_flag)
            portfolio_fit = portfolio_fit_from_risk(risk_flag)
            asset_type = (row["asset_type"] or "asset").upper()

            data.append(
                {
                    "symbol": symbol,
                    "name": symbol,
                    "portfolio_fit": portfolio_fit,
                    "price": price,
                    "change_pct": round(change_pct, 4),
                    "spark_data": spark_data,
                    "color": ASSET_COLORS[idx % len(ASSET_COLORS)],
                    "glow_class": ASSET_GLOWS[idx % len(ASSET_GLOWS)],
                    "outlook": f"{asset_type} signal is {portfolio_fit.lower()} with a {risk_band.lower()} risk profile.",
                    "risk_band": risk_band,
                    "confidence": confidence,
                }
            )

    return {"data": data}


@app.get("/dashboard/candles")
def dashboard_candles(symbol: str, limit: int = 60):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT date, open, high, low, close, volume
            FROM market_data
            WHERE UPPER(symbol) = UPPER(?)
            ORDER BY date DESC
            LIMIT ?
            """,
            (symbol, max(1, min(limit, 1000))),
        ).fetchall()

    if not rows:
        return {"data": []}

    candles = [
        {
            "date": row["date"],
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(row["volume"]) if row["volume"] is not None else None,
        }
        for row in reversed(rows)
    ]
    return {"data": candles}


@app.post("/account/register", response_model=AccountStateResponse)
def register_account(request: AccountAuthRequest):
    email = normalize_email(request.email)
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Please use a valid email address.")

    password = request.password.strip()
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password should be at least 4 characters long.")

    with get_conn() as conn:
        existing = conn.execute("SELECT email FROM account_users WHERE email = ?", (email,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="That email already exists. Please sign in instead.")

        conn.execute(
            "INSERT INTO account_users (email, password, role) VALUES (?, ?, 'user')",
            (email, password),
        )
        portfolio = get_or_create_portfolio(conn, email, "user")

    return AccountStateResponse(session=AccountSession(email=email, role="user"), portfolio=portfolio)


@app.post("/account/login", response_model=AccountStateResponse)
def login_account(request: AccountAuthRequest):
    email = normalize_email(request.email)
    password = request.password.strip()

    with get_conn() as conn:
        row = conn.execute(
            "SELECT email, role FROM account_users WHERE email = ? AND password = ?",
            (email, password),
        ).fetchone()
        if not row:
            raise HTTPException(
                status_code=401,
                detail="We couldn't find that account. Try the demo admin or create a new account.",
            )

        role: Role = row["role"]
        portfolio = get_or_create_portfolio(conn, email, role)

    return AccountStateResponse(
        session=AccountSession(email=row["email"], role=role),
        portfolio=portfolio,
    )


@app.get("/account/portfolio", response_model=PortfolioState)
def load_portfolio(email: str):
    normalized = normalize_email(email)
    with get_conn() as conn:
        user = conn.execute(
            "SELECT role FROM account_users WHERE email = ?",
            (normalized,),
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Account not found.")

        portfolio = get_or_create_portfolio(conn, normalized, user["role"])
    return portfolio


@app.post("/account/portfolio", response_model=PortfolioState)
def save_portfolio(request: SavePortfolioRequest):
    email = normalize_email(request.email)
    with get_conn() as conn:
        exists = conn.execute("SELECT email FROM account_users WHERE email = ?", (email,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Account not found.")

        conn.execute(
            """
            INSERT INTO account_portfolios (email, starting_cash, cash, holdings_json, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(email) DO UPDATE SET
                starting_cash = excluded.starting_cash,
                cash = excluded.cash,
                holdings_json = excluded.holdings_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                email,
                request.portfolio.startingCash,
                request.portfolio.cash,
                json.dumps([holding.model_dump() for holding in request.portfolio.holdings]),
            ),
        )

    return request.portfolio
