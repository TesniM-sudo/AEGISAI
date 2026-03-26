import sqlite3
from typing import Dict, List, Optional

from config import DB_PATH


class DatabaseError(Exception):
    pass


class AegisDB:
    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path

    def _connect(self) -> sqlite3.Connection:
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn
        except sqlite3.Error as exc:
            raise DatabaseError(f"Failed to connect to database: {exc}") from exc

    def list_symbols(self) -> List[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT DISTINCT symbol FROM market_data ORDER BY symbol"
            ).fetchall()
        return [row["symbol"] for row in rows]

    def get_latest_risk(self, symbol: str) -> Optional[Dict]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT symbol, date, close, anomaly, risk_flag, volatility_7d, ma_7d, ma_30d
                FROM market_risk_predictions
                WHERE UPPER(symbol) = UPPER(?)
                ORDER BY date DESC
                LIMIT 1
                """,
                (symbol,),
            ).fetchone()
        return dict(row) if row else None

    def get_recent_prices(self, symbol: str, days: int = 7) -> List[Dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT date, close, volume
                FROM market_data
                WHERE UPPER(symbol) = UPPER(?)
                ORDER BY date DESC
                LIMIT ?
                """,
                (symbol, days),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_latest_features(self, symbol: str) -> Optional[Dict]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT symbol, date, daily_return, volatility_7d, ma_7d, ma_30d, close
                FROM market_data_features
                WHERE UPPER(symbol) = UPPER(?)
                ORDER BY date DESC
                LIMIT 1
                """,
                (symbol,),
            ).fetchone()
        return dict(row) if row else None
