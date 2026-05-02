import math
import re
from typing import Any, Dict, List, Tuple

from db_tools import AegisDB
from routes.account import get_account_record

FINANCE_EXPLANATIONS = {
    "volatility": "Volatility means how much a price moves up and down. Higher volatility means the asset is less stable in the short term.",
    "moving average": "A moving average is the average price over a period of time. It helps you see the bigger trend more clearly.",
    "risk": "Risk here means how dangerous or unstable an asset currently looks based on the project's data.",
    "daily return": "Daily return is the percentage change in price from one day to the next.",
}

ADVICE_KEYWORDS = ("advice", "suggest", "recommend", "improve", "what should i do", "spending")


class FinanceAssistant:
    """Rule-based assistant grounded in stored account data and latest risk results."""

    def __init__(self, db: AegisDB | None = None):
        self.db = db or AegisDB()
        self.available_symbols = self.db.list_symbols()
        self.symbol_aliases = {
            "bitcoin": "BTC-USD",
            "btc": "BTC-USD",
            "ethereum": "ETH-USD",
            "eth": "ETH-USD",
            "apple": "AAPL",
            "tesla": "TSLA",
            "euro": "EURUSD=X",
            "eur": "EURUSD=X",
            "dollar": "EURUSD=X",
        }

    def refresh_symbols(self) -> None:
        """Refresh the supported symbols from the database."""
        self.available_symbols = self.db.list_symbols()

    def detect_symbols(self, message: str) -> List[str]:
        """Extract supported asset symbols from a message."""
        message_upper = message.upper()
        message_lower = message.lower()
        found = [symbol for symbol in self.available_symbols if symbol.upper() in message_upper]

        for alias, symbol in self.symbol_aliases.items():
            if alias in message_lower and symbol not in found:
                found.append(symbol)

        return found[:2]

    def _extract_days(self, message: str) -> int:
        match = re.search(r"(\d+)\s*day", message.lower())
        if match:
            return max(2, min(30, int(match.group(1))))
        return 7

    def _clean_value(self, value: Any) -> Any:
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value

    def _clean_record(self, record: Dict[str, Any] | None) -> Dict[str, Any]:
        if not record:
            return {}
        return {key: self._clean_value(value) for key, value in record.items()}

    def _symbol_display_name(self, symbol: str) -> str:
        reverse_aliases = {
            "AAPL": "Apple",
            "TSLA": "Tesla",
            "BTC-USD": "Bitcoin",
            "ETH-USD": "Ethereum",
            "EURUSD=X": "EUR/USD",
        }
        return reverse_aliases.get(symbol, symbol)

    def _trend_label(self, symbol: str, message: str) -> str:
        recent_prices = list(reversed(self.db.get_recent_prices(symbol, self._extract_days(message))))
        if len(recent_prices) >= 2:
            first = float(recent_prices[0]["close"])
            last = float(recent_prices[-1]["close"])
            if last > first:
                return "up"
            if last < first:
                return "down"
        return "steady"

    def _extract_budget(self, message: str) -> float | None:
        match = re.search(r"\$?\s*(\d+(?:\.\d+)?)", message.replace(",", ""))
        if not match:
            return None
        try:
            value = float(match.group(1))
        except ValueError:
            return None
        return value if value > 0 else None

    def _intent_from_message(self, message: str, symbols: List[str], user_id: str | None) -> str:
        lowered = message.lower()
        if user_id and any(keyword in lowered for keyword in ADVICE_KEYWORDS):
            return "portfolio_advice"
        if user_id and "risk" in lowered and not symbols:
            return "portfolio_risk"
        if "list supported symbols" in lowered or ("list" in lowered and "symbol" in lowered):
            return "list_symbols"
        if any(word in lowered for word in ["compare", "versus", "vs"]) and len(symbols) >= 2:
            return "compare_assets"
        if len(symbols) >= 2 and any(word in lowered for word in [" or ", " and "]):
            return "compare_assets"
        if any(word in lowered for word in ["trend", "history", "last", "recent"]) and symbols:
            return "trend_summary"
        if any(phrase in lowered for phrase in ["where shall i invest", "where should i invest", "what should i invest in", "i have $", "i have ", "advice"]):
            return "investment_guidance"
        if "latest risk" in lowered or ("risk" in lowered and any(word in lowered for word in ["latest", "current", "now"])):
            return "latest_risk"
        if "explain" in lowered or "what is" in lowered or "what does" in lowered:
            return "explain_term"
        if symbols:
            if len(symbols) >= 2:
                return "compare_assets"
            return "latest_risk"
        return "general_help"

    def _build_user_snapshot(self, user_id: str) -> Dict[str, Any]:
        """Build a lightweight user context from portfolio data and latest risk rows."""
        account = get_account_record(user_id)
        if not account:
            return {}

        portfolio = account.get("portfolio", {})
        holdings = portfolio.get("holdings", [])
        starting_cash = float(portfolio.get("startingCash", 0) or 0)
        cash = float(portfolio.get("cash", 0) or 0)
        spent_amount = max(starting_cash - cash, 0.0)
        spent_ratio = (spent_amount / starting_cash) if starting_cash else 0.0

        holding_details: List[Dict[str, Any]] = []
        total_market_value = 0.0
        high_risk_count = 0

        for holding in holdings:
            symbol = holding.get("symbol", "")
            risk = self._clean_record(self.db.get_latest_risk(symbol))
            latest_close = float(risk.get("close") or holding.get("avgPrice") or 0.0)
            market_value = float(holding.get("quantity", 0) or 0) * latest_close
            total_market_value += market_value
            if int(risk.get("risk_flag") or 0) == 1:
                high_risk_count += 1
            holding_details.append(
                {
                    "symbol": symbol,
                    "name": holding.get("name") or self._symbol_display_name(symbol),
                    "quantity": float(holding.get("quantity", 0) or 0),
                    "avg_price": float(holding.get("avgPrice", 0) or 0),
                    "market_value": market_value,
                    "risk": risk,
                }
            )

        highest_risk = max(
            holding_details,
            key=lambda item: (float(item["risk"].get("risk_score") or 0), int(item["risk"].get("risk_flag") or 0)),
            default=None,
        )

        top_holding_value = max((item["market_value"] for item in holding_details), default=0.0)
        concentration_ratio = (top_holding_value / total_market_value) if total_market_value else 0.0

        return {
            "email": account.get("email"),
            "cash": cash,
            "starting_cash": starting_cash,
            "spent_amount": spent_amount,
            "spent_ratio": spent_ratio,
            "holding_count": len(holding_details),
            "high_risk_count": high_risk_count,
            "concentration_ratio": concentration_ratio,
            "holdings": holding_details,
            "highest_risk": highest_risk,
        }

    def _no_data_message(self) -> str:
        return "I do not have enough transaction or risk data for your account yet. Add portfolio activity first, then ask again."

    def generate_response(self, user_id: str, message: str) -> str:
        """Generate a contextual chatbot reply from user portfolio and risk data."""
        snapshot = self._build_user_snapshot(user_id)
        if not snapshot or not snapshot["holdings"]:
            return self._no_data_message()

        lowered = message.lower()
        highest_risk = snapshot.get("highest_risk")

        if "risk" in lowered:
            if not highest_risk:
                return self._no_data_message()
            risk = highest_risk["risk"]
            symbol = highest_risk["symbol"]
            score = float(risk.get("risk_score") or 0)
            risk_label = "HIGH" if int(risk.get("risk_flag") or 0) == 1 else "LOW"
            return (
                f"Your latest portfolio risk looks {risk_label} with a score of {score:.1f}, driven most by {symbol}. "
                f"You currently hold {snapshot['holding_count']} asset(s), with {snapshot['high_risk_count']} flagged as high risk."
            )

        if any(keyword in lowered for keyword in ADVICE_KEYWORDS):
            suggestions: List[str] = []
            if snapshot["spent_ratio"] > 0.75:
                suggestions.append("Slow new spending and keep a larger cash buffer for the next few trades.")
            elif snapshot["spent_ratio"] < 0.25:
                suggestions.append("You are deploying cash cautiously, so add exposure gradually instead of making one large move.")

            if snapshot["concentration_ratio"] > 0.6:
                suggestions.append("Your portfolio is concentrated in one position, so diversify to reduce single-asset risk.")

            if snapshot["high_risk_count"] > 0:
                suggestions.append("Reduce exposure to the highest-risk holding or offset it with a steadier asset.")

            if not suggestions:
                suggestions.append("Keep monitoring your risk signals and rebalance only in small steps as prices change.")

            return " ".join(suggestions[:2])

        highest_symbol = highest_risk["symbol"] if highest_risk else snapshot["holdings"][0]["symbol"]
        return (
            f"I can explain your current risk or give portfolio advice. Right now your account is most exposed to {highest_symbol}, "
            f"and you have used about {snapshot['spent_ratio'] * 100:.0f}% of your starting cash."
        )

    def _fallback_reply(self, intent: str, message: str, symbols: List[str]) -> str:
        lowered = message.lower().strip()

        if lowered in {"hi", "hello", "hey", "hey there"}:
            return "Hi, I'm AegisAI. Ask me about your risk, your portfolio advice, or a tracked asset like Apple or Bitcoin."

        if intent == "list_symbols":
            top = self.available_symbols[:20]
            return "Here are some tracked symbols: " + ", ".join(top) + (" ..." if len(self.available_symbols) > 20 else "")

        if intent == "latest_risk" and symbols:
            symbol = symbols[0]
            risk = self._clean_record(self.db.get_latest_risk(symbol))
            if not risk:
                return f"I could not find recent risk data for {symbol}."
            risk_label = "risky" if risk.get("risk_flag") == 1 else "safer"
            trend = self._trend_label(symbol, message)
            return f"{self._symbol_display_name(symbol)} ({symbol}) looks {risk_label} right now, and its recent trend is {trend}."

        if intent == "compare_assets" and len(symbols) >= 2:
            parts = []
            for symbol in symbols[:2]:
                risk = self._clean_record(self.db.get_latest_risk(symbol))
                if risk:
                    risk_label = "riskier" if risk.get("risk_flag") == 1 else "safer"
                    parts.append(f"{self._symbol_display_name(symbol)} looks {risk_label}")
            if parts:
                return ". ".join(parts) + "."
            return "I could not find enough data to compare those assets."

        if intent == "explain_term":
            for key, text in FINANCE_EXPLANATIONS.items():
                if key in lowered:
                    return text
            return "That finance term is best understood by looking at whether price movement is stable or jumpy."

        if intent == "trend_summary" and symbols:
            symbol = symbols[0]
            prices = list(reversed(self.db.get_recent_prices(symbol, self._extract_days(message))))
            if len(prices) < 2:
                return f"I do not have enough recent price history for {symbol}."
            first = float(prices[0]["close"])
            last = float(prices[-1]["close"])
            change_pct = ((last - first) / first) * 100 if first else 0
            direction = "up" if change_pct >= 0 else "down"
            return f"{self._symbol_display_name(symbol)} moved {direction} over the recent period, by about {abs(change_pct):.2f}%."

        if intent == "investment_guidance":
            budget = self._extract_budget(message)
            if budget is not None and budget <= 500:
                return "With a small budget like that, it is usually smarter to start simple and spread risk. You could begin with one steadier tracked asset like Apple, or split gradually instead of putting everything into the most volatile option."
            if budget is not None:
                return "A good starting idea is to balance safer assets and more volatile ones instead of putting everything in one place. If you want, I can compare Apple, Tesla, Bitcoin, and Ethereum in simple words."
            return "That depends on how much risk you can handle. If you want something steadier, look first at Apple or EUR/USD, and if you accept bigger ups and downs, Bitcoin or Tesla are more aggressive choices."

        return "I can help with your account risk, portfolio advice, tracked assets like Apple and Bitcoin, or explain finance terms in simple words."

    def handle_message(self, message: str, user_id: str | None = None) -> Tuple[str, str, List[str], Dict[str, Any]]:
        """Route a chat message through the rule-based assistant."""
        symbols = self.detect_symbols(message)
        intent = self._intent_from_message(message, symbols, user_id)
        structured: Dict[str, Any] = {
            symbol: {
                "risk": self._clean_record(self.db.get_latest_risk(symbol)),
                "features": self._clean_record(self.db.get_latest_features(symbol)),
            }
            for symbol in symbols
        }

        if user_id:
            structured["user_context"] = self._build_user_snapshot(user_id)

        if user_id and intent in {"portfolio_risk", "portfolio_advice"}:
            return self.generate_response(user_id, message), intent, symbols, structured

        return self._fallback_reply(intent, message, symbols), intent, symbols, structured


def generate_response(user_id: str, message: str) -> str:
    """Convenience wrapper for contextual chatbot responses."""
    return FinanceAssistant().generate_response(user_id, message)
