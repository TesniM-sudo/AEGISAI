import re
from typing import Dict, List, Tuple

from config import DEFAULT_HISTORY_DAYS
from db_tools import AegisDB


FINANCE_EXPLANATIONS = {
    "volatility": "Volatility measures how much a price moves up and down. Higher volatility usually means more uncertainty and more risk.",
    "moving average": "A moving average smooths price data over a time window. In your project, MA 7D is the 7-day average and MA 30D is the 30-day average.",
    "risk": "In this project, risk is derived from your anomaly and risk flag outputs. It is a project risk signal, not a guaranteed market forecast.",
    "daily return": "Daily return is the percentage change in closing price from one trading day to the next.",
}


class FinanceAssistant:
    def __init__(self, db: AegisDB | None = None):
        self.db = db or AegisDB()
        self.available_symbols = self.db.list_symbols()

    def refresh_symbols(self) -> None:
        self.available_symbols = self.db.list_symbols()

    def detect_symbols(self, message: str) -> List[str]:
        message_upper = message.upper()
        found = [symbol for symbol in self.available_symbols if symbol.upper() in message_upper]
        return found[:2]

    def detect_intent(self, message: str, symbols: List[str]) -> str:
        lowered = message.lower()
        if "list supported symbols" in lowered or ("list" in lowered and "symbol" in lowered):
            return "list_symbols"
        if any(word in lowered for word in ["compare", "versus", "vs"]) and len(symbols) >= 2:
            return "compare_assets"
        if any(word in lowered for word in ["trend", "history", "last", "recent"]):
            return "trend_summary"
        if "risk" in lowered and symbols:
            return "latest_risk"
        if any(word in lowered for word in ["explain", "what is", "what does"]):
            for key in FINANCE_EXPLANATIONS:
                if key in lowered and not symbols:
                    return "explain_term"
        if symbols:
            return "latest_risk"
        return "fallback"

    def _extract_days(self, message: str) -> int:
        match = re.search(r"(\d+)\s*day", message.lower())
        if match:
            return max(2, min(30, int(match.group(1))))
        return DEFAULT_HISTORY_DAYS

    def _risk_label(self, risk_flag: int | None) -> str:
        if risk_flag is None:
            return "unknown"
        return "high" if int(risk_flag) == 1 else "low"

    def _format_number(self, value) -> str:
        if value is None:
            return "N/A"
        try:
            return f"{float(value):,.2f}"
        except (TypeError, ValueError):
            return str(value)

    def handle_message(self, message: str) -> Tuple[str, str, List[str], Dict]:
        symbols = self.detect_symbols(message)
        intent = self.detect_intent(message, symbols)

        if intent == "list_symbols":
            top = self.available_symbols[:20]
            reply = (
                "Supported symbols currently in the database: "
                + ", ".join(top)
                + (" ..." if len(self.available_symbols) > 20 else "")
            )
            return reply, intent, [], {"count": len(self.available_symbols), "symbols": top}

        if intent == "explain_term":
            lowered = message.lower()
            for key, text in FINANCE_EXPLANATIONS.items():
                if key in lowered:
                    return text, intent, [], {"term": key}

        if intent == "latest_risk" and symbols:
            symbol = symbols[0]
            risk = self.db.get_latest_risk(symbol)
            features = self.db.get_latest_features(symbol)
            if not risk:
                return (
                    f"I could not find the latest risk prediction for {symbol}.",
                    intent,
                    [symbol],
                    {},
                )
            label = self._risk_label(risk.get("risk_flag"))
            reply = (
                f"Latest risk for {symbol}: {label.upper()} risk on {risk['date']}. "
                f"Latest close price: {self._format_number(risk.get('close'))}. "
                f"7-day volatility: {self._format_number(risk.get('volatility_7d'))}."
            )
            return reply, intent, [symbol], {"risk": risk, "features": features}

        if intent == "trend_summary" and symbols:
            symbol = symbols[0]
            days = self._extract_days(message)
            prices = list(reversed(self.db.get_recent_prices(symbol, days)))
            if len(prices) < 2:
                return (
                    f"I do not have enough recent price history for {symbol}.",
                    intent,
                    [symbol],
                    {},
                )
            first_close = float(prices[0]["close"])
            last_close = float(prices[-1]["close"])
            change_pct = ((last_close - first_close) / first_close) * 100 if first_close else 0.0
            direction = "upward" if change_pct >= 0 else "downward"
            reply = (
                f"{symbol} shows a {direction} trend over the last {len(prices)} days. "
                f"It moved from {self._format_number(first_close)} to {self._format_number(last_close)}, "
                f"which is {change_pct:.2f}% overall."
            )
            return reply, intent, [symbol], {"prices": prices, "change_pct": change_pct}

        if intent == "compare_assets" and len(symbols) >= 2:
            left, right = symbols[:2]
            risk_left = self.db.get_latest_risk(left)
            risk_right = self.db.get_latest_risk(right)
            if not risk_left or not risk_right:
                return (
                    "I could not compare those assets because one of them is missing recent risk data.",
                    intent,
                    [left, right],
                    {},
                )
            left_label = self._risk_label(risk_left.get("risk_flag"))
            right_label = self._risk_label(risk_right.get("risk_flag"))
            reply = (
                f"Comparison summary: {left} is currently marked {left_label.upper()} risk with close price {self._format_number(risk_left.get('close'))}, "
                f"while {right} is marked {right_label.upper()} risk with close price {self._format_number(risk_right.get('close'))}."
            )
            return reply, intent, [left, right], {"left": risk_left, "right": risk_right}

        fallback = (
            "I can currently help with latest risk, recent trends, symbol comparison, supported symbols, and explaining terms like volatility or moving average. "
            "Try messages like: 'What is the latest risk for AAPL?' or 'Compare AAPL and BTC-USD'."
        )
        return fallback, intent, symbols, {}
