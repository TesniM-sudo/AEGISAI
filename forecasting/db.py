from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.engine import Engine


def ensure_forecasts_table(engine: Engine) -> None:
    ddl = """
        CREATE TABLE IF NOT EXISTS market_risk_forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            symbol TEXT,
            drawdown_7d REAL,
            drawdown_30d REAL,
            vol_spike_7d REAL,
            vol_spike_30d REAL,
            anomaly_7d REAL,
            anomaly_30d REAL
        )
    """
    with engine.begin() as conn:
        conn.execute(text(ddl))

        # Backward-compatible migration: add symbol column if older table exists.
        cols = conn.execute(text("PRAGMA table_info(market_risk_forecasts)")).mappings().all()
        col_names = {str(row["name"]).lower() for row in cols}
        if "symbol" not in col_names:
            conn.execute(text("ALTER TABLE market_risk_forecasts ADD COLUMN symbol TEXT"))


def insert_forecast(engine: Engine, timestamp: str, probs: Dict[str, float], symbol: str | None = None) -> None:
    ensure_forecasts_table(engine)
    sql = text(
        """
        INSERT INTO market_risk_forecasts (
            timestamp,
            symbol,
            drawdown_7d,
            drawdown_30d,
            vol_spike_7d,
            vol_spike_30d,
            anomaly_7d,
            anomaly_30d
        ) VALUES (
            :timestamp,
            :symbol,
            :drawdown_7d,
            :drawdown_30d,
            :vol_spike_7d,
            :vol_spike_30d,
            :anomaly_7d,
            :anomaly_30d
        )
        """
    )
    payload = {
        "timestamp": timestamp,
        "symbol": symbol,
        "drawdown_7d": float(probs["drawdown_7d"]),
        "drawdown_30d": float(probs["drawdown_30d"]),
        "vol_spike_7d": float(probs["vol_spike_7d"]),
        "vol_spike_30d": float(probs["vol_spike_30d"]),
        "anomaly_7d": float(probs["anomaly_7d"]),
        "anomaly_30d": float(probs["anomaly_30d"]),
    }
    with engine.begin() as conn:
        conn.execute(sql, payload)


def get_latest_forecast(engine: Engine, symbol: str | None = None) -> Optional[Dict[str, Any]]:
    ensure_forecasts_table(engine)
    if symbol:
        sql = text(
            """
            SELECT
                id,
                timestamp,
                symbol,
                drawdown_7d,
                drawdown_30d,
                vol_spike_7d,
                vol_spike_30d,
                anomaly_7d,
                anomaly_30d
            FROM market_risk_forecasts
            WHERE UPPER(symbol) = UPPER(:symbol)
            ORDER BY timestamp DESC, id DESC
            LIMIT 1
            """
        )
        params = {"symbol": symbol}
    else:
        sql = text(
            """
            SELECT
                id,
                timestamp,
                symbol,
                drawdown_7d,
                drawdown_30d,
                vol_spike_7d,
                vol_spike_30d,
                anomaly_7d,
                anomaly_30d
            FROM market_risk_forecasts
            ORDER BY id DESC
            LIMIT 1
            """
        )
        params = {}
    with engine.begin() as conn:
        row = conn.execute(sql, params).mappings().first()
    return dict(row) if row else None


def get_recent_forecasts(engine: Engine, symbol: str, limit: int = 2) -> list[Dict[str, Any]]:
    """Return the most recent forecast rows for a symbol (newest first)."""
    ensure_forecasts_table(engine)
    sql = text(
        """
        SELECT
            id,
            timestamp,
            symbol,
            drawdown_7d,
            drawdown_30d,
            vol_spike_7d,
            vol_spike_30d,
            anomaly_7d,
            anomaly_30d
        FROM market_risk_forecasts
        WHERE symbol IS NOT NULL AND UPPER(symbol) = UPPER(:symbol)
        ORDER BY timestamp DESC, id DESC
        LIMIT :limit
        """
    )
    with engine.begin() as conn:
        rows = conn.execute(sql, {"symbol": symbol, "limit": int(limit)}).mappings().all()
    return [dict(r) for r in rows]
