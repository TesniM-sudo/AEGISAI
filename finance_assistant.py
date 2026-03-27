import re
from typing import Dict, List, Tuple
from groq import Groq
from config import DEFAULT_HISTORY_DAYS, GROQ_API_KEY, GROQ_MODEL
from db_tools import AegisDB

client = Groq(api_key=GROQ_API_KEY)

class FinanceAssistant:
    def __init__(self, db: AegisDB | None = None):
        self.db = db or AegisDB()
        self.available_symbols = self.db.list_symbols()
        self.symbol_aliases = {
            'bitcoin': 'BTC-USD', 'btc': 'BTC-USD',
            'ethereum': 'ETH-USD', 'eth': 'ETH-USD',
            'apple': 'AAPL', 'tesla': 'TSLA',
            'euro': 'EURUSD=X', 'eur': 'EURUSD=X',
        }

    def refresh_symbols(self):
        self.available_symbols = self.db.list_symbols()

    def detect_symbols(self, message: str) -> List[str]:
        message_upper = message.upper()
        message_lower = message.lower()
        found = [s for s in self.available_symbols if s.upper() in message_upper]
        for alias, symbol in self.symbol_aliases.items():
            if alias in message_lower and symbol not in found:
                found.append(symbol)
        return found[:2]

    def _extract_days(self, message: str) -> int:
        match = re.search(r'(\d+)\s*day', message.lower())
        if match:
            return max(2, min(30, int(match.group(1))))
        return DEFAULT_HISTORY_DAYS

    def _build_context(self, message: str, symbols: List[str]) -> str:
        context = 'You are AegisAI, a friendly financial guide. Be warm, simple, and encouraging. Never use raw numbers directly - translate them into plain English. Keep responses to 3-5 sentences. Always end with: Remember, this is not financial advice.\n\n'
        if not symbols:
            context += f'Available symbols: {", ".join(self.available_symbols[:10])}\n'
            return context
        for symbol in symbols:
            risk = self.db.get_latest_risk(symbol)
            days = self._extract_days(message)
            prices = list(reversed(self.db.get_recent_prices(symbol, days)))
            if risk:
                context += f'=== {symbol} ===\n'
                context += f'Close: {risk.get("close")}\n'
                context += f'Risk: {"HIGH" if risk.get("risk_flag") == 1 else "LOW"}\n'
                context += f'Anomaly: {risk.get("anomaly")}\n'
                context += f'Volatility 7d: {risk.get("volatility_7d")}\n'
                context += f'MA7: {risk.get("ma_7d")}, MA30: {risk.get("ma_30d")}\n\n'
            if prices and len(prices) >= 2:
                first = float(prices[0]['close'])
                last = float(prices[-1]['close'])
                change = ((last - first) / first) * 100 if first else 0
                context += f'Price trend: {first:.2f} to {last:.2f} ({change:.2f}%)\n\n'
        return context

    def handle_message(self, message: str) -> Tuple[str, str, List[str], Dict]:
        symbols = self.detect_symbols(message)
        context = self._build_context(message, symbols)
        prompt = f'{context}\nUser question: {message}'
        try:
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=512,
                temperature=0.4,
            )
            reply = response.choices[0].message.content.strip()
        except Exception as e:
            reply = f'Sorry, I could not process your request. Error: {str(e)}'
        structured = {}
        for symbol in symbols:
            structured[symbol] = {'risk': self.db.get_latest_risk(symbol)}
        return reply, 'llm_response', symbols, structured
