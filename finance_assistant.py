import math
import re
from typing import Dict, List, Tuple

from groq import Groq

from config import DEFAULT_HISTORY_DAYS, GROQ_API_KEY, GROQ_MODEL
from db_tools import AegisDB

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

FINANCE_EXPLANATIONS = {
    "volatility": "Volatility means how much a price moves up and down. Higher volatility means the asset is less stable in the short term.",
    "moving average": "A moving average is the average price over a period of time. It helps you see the bigger trend more clearly.",
    "risk": "Risk here means how dangerous or unstable an asset currently looks based on the project's data.",
    "daily return": "Daily return is the percentage change in price from one day to the next.",
}


class FinanceAssistant:
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
        self.available_symbols = self.db.list_symbols()

    def detect_symbols(self, message: str) -> List[str]:
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
        return DEFAULT_HISTORY_DAYS

    def _clean_value(self, value):
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value

    def _clean_record(self, record: Dict | None) -> Dict:
        if not record:
            return {}
        return {key: self._clean_value(value) for key, value in record.items()}

    def _intent_from_message(self, message: str, symbols: List[str]) -> str:
        lowered = message.lower()
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
        return "llm_response"

    def _build_context(self, message: str, symbols: List[str]) -> str:
        context = """You are AegisAI, a friendly financial guide for beginners.

Your personality:
- Simple, clear, and helpful
- Never technical or complicated

Your rules:
- Translate all technical data into plain English
- Focus only on: risk (safe or risky) and trend (up or down)
- If needed, give ONE short beginner tip
- Keep responses very short: maximum 2 sentences
- Do not include disclaimers
"""

        if not symbols:
            context += f"\nAvailable symbols: {', '.join(self.available_symbols[:10])}"
            return context

        for symbol in symbols:
            risk = self._clean_record(self.db.get_latest_risk(symbol))
            prices = list(reversed(self.db.get_recent_prices(symbol, self._extract_days(message))))

            if risk:
                context += f"\n=== {symbol} ===\n"
                context += f"Price: {risk.get('close')}\n"
                context += f"Risk: {'HIGH' if risk.get('risk_flag') == 1 else 'LOW'}\n"
                context += f"Volatility: {risk.get('volatility_7d')}\n"
                context += f"MA7: {risk.get('ma_7d')} | MA30: {risk.get('ma_30d')}\n"

            if prices and len(prices) >= 2:
                first = float(prices[0]["close"])
                last = float(prices[-1]["close"])
                change = ((last - first) / first) * 100 if first else 0
                context += f"Trend: {change:.2f}% over {len(prices)} days\n"

        return context

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

    def _symbol_display_name(self, symbol: str) -> str:
        reverse_aliases = {
            "AAPL": "Apple",
            "TSLA": "Tesla",
            "BTC-USD": "Bitcoin",
            "ETH-USD": "Ethereum",
            "EURUSD=X": "EUR/USD",
        }
        return reverse_aliases.get(symbol, symbol)

    def _extract_budget(self, message: str) -> float | None:
        match = re.search(r"\$?\s*(\d+(?:\.\d+)?)", message.replace(",", ""))
        if not match:
            return None
        try:
            value = float(match.group(1))
        except ValueError:
            return None
        return value if value > 0 else None

    def _fallback_reply(self, intent: str, message: str, symbols: List[str]) -> str:
        lowered = message.lower().strip()

        if lowered in {"hi", "hello", "hey", "hey there"}:
            return "Hi, I'm AegisAI. Ask me about a tracked asset like Apple, Tesla, Bitcoin, or ask me to explain a finance term simply."

        if intent == "list_symbols":
            top = self.available_symbols[:20]
            return (
                "Here are some tracked symbols: "
                + ", ".join(top)
                + (" ..." if len(self.available_symbols) > 20 else "")
            )

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

        if symbols:
            symbol = symbols[0]
            risk = self._clean_record(self.db.get_latest_risk(symbol))
            if risk:
                trend = self._trend_label(symbol, message)
                risk_label = "risky" if risk.get("risk_flag") == 1 else "safer"
                return f"{self._symbol_display_name(symbol)} is one of the tracked assets. Right now it looks {risk_label}, and its recent trend is {trend}."

        return "I can help with tracked assets like Apple, Tesla, Bitcoin, Ethereum, or EUR/USD. You can also ask me to compare assets or explain a finance term in simple words."

    def _call_llm(self, message: str, context: str) -> str:
        if client is None:
            raise RuntimeError("Missing GROQ_API_KEY")

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": context},
                {"role": "user", "content": message},
            ],
            max_tokens=120,
            temperature=0.4,
        )
        reply = response.choices[0].message.content.strip()
        reply = re.sub(r"remember,? this is not financial advice.*", "", reply, flags=re.IGNORECASE).strip()
        return reply

    def handle_message(self, message: str) -> Tuple[str, str, List[str], Dict]:
        symbols = self.detect_symbols(message)
        intent = self._intent_from_message(message, symbols)
        structured = {
            symbol: {
                "risk": self._clean_record(self.db.get_latest_risk(symbol)),
                "features": self._clean_record(self.db.get_latest_features(symbol)),
            }
            for symbol in symbols
        }

        if intent in {"list_symbols", "latest_risk", "compare_assets", "explain_term", "trend_summary", "investment_guidance"}:
            return self._fallback_reply(intent, message, symbols), intent, symbols, structured

        context = self._build_context(message, symbols)
        try:
            reply = self._call_llm(message, context)
            if not reply:
                reply = self._fallback_reply(intent, message, symbols)
        except Exception:
            reply = self._fallback_reply(intent, message, symbols)

        return reply, intent, symbols, structured
