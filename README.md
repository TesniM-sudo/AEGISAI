# 🛡️ AegisAI — AI-Powered Financial Risk Guardian

AegisAI is a full-stack AI application that combines machine learning, a Groq LLM-powered chatbot, and a modern React dashboard to help everyday users understand financial risk in plain, beginner-friendly language.

---

## ✨ Features

- 📊 **Real-time Dashboard** — Live asset cards with prices, risk bands, momentum curves, and confidence scores
- 🕯️ **Candlestick Charts** — Real OHLC data for BTC, ETH, AAPL, TSLA, and EUR/USD
- 🤖 **AI Chatbot** — Powered by Groq LLM (llama-3.3-70b-versatile), grounded in real ML predictions
- 🧠 **Machine Learning Pipeline** — Isolation Forest (anomaly detection) + Logistic Regression (risk classification)
- 💬 **Natural Language Understanding** — Recognizes aliases like "Bitcoin" → BTC-USD, "Apple" → AAPL
- 🔒 **Secure** — API keys stored in `.env`, never committed to GitHub

---

## 🗂️ Repository Structure

```
AEGISAI/
├── master branch          → Full backend (FastAPI + ML + Chatbot)
└── datasite branch        → Frontend (React + TypeScript + Vite)
```

### Backend (master branch)
```
├── main.py                → Unified FastAPI app with all endpoints
├── finance_assistant.py   → Groq LLM chatbot with context building
├── database.py            → SQLite schema definition
├── data_collector.py      → Yahoo Finance data fetcher
├── feature_engineering.py → Financial feature calculation
├── train.py               → ML model training
├── ml_models.py           → Model loading and prediction
├── risk_engine.py         → Runs predictions and stores results
├── db_tools.py            → Database helper class
├── config.py              → Centralized configuration
├── schemas.py             → API request/response models
└── run_local.py           → Local server startup
```

### Frontend (datasite branch)
```
dataweb/AegisAI_Website_v3_DBAssets/
├── src/
│   ├── pages/
│   │   ├── Index.tsx          → Main dashboard
│   │   ├── Account.tsx        → User account page
│   │   └── Trade.tsx          → Trading simulation
│   ├── components/
│   │   ├── CryptoCard.tsx     → Asset card component
│   │   ├── CryptoChat.tsx     → AI chatbot UI
│   │   ├── CandlestickChart.tsx → OHLC chart
│   │   └── AssetDetailView.tsx → Detailed asset view
│   └── lib/
│       └── marketApi.ts       → Backend API client
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| Database | SQLite + SQLAlchemy |
| Machine Learning | scikit-learn |
| LLM | Groq API (llama-3.3-70b-versatile) |
| Data Source | Yahoo Finance (yfinance) |
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| API Server | Uvicorn |

---

## 🚀 Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- A free [Groq API key](https://console.groq.com)

### Backend Setup

```bash
# 1. Clone the repo and switch to master branch
git clone https://github.com/TesniM-sudo/AEGISAI.git
cd AEGISAI

# 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Mac/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set your Groq API key
# Windows PowerShell:
$env:GROQ_API_KEY = "your_key_here"
# Or set permanently:
[System.Environment]::SetEnvironmentVariable("GROQ_API_KEY", "your_key_here", "User")

# 5. Initialize the database and run the full pipeline
python database.py
python data_collector.py
python feature_engineering.py
python train.py
python risk_engine.py

# 6. Start the backend (runs on port 8010)
python run_local.py
```

### Frontend Setup

```bash
# 1. Switch to datasite branch
git checkout datasite

# 2. Navigate to the frontend folder
cd dataweb/AegisAI_Website_v3_DBAssets

# 3. Create .env file
echo "VITE_SUPABASE_URL=http://127.0.0.1:8010" > .env
echo "VITE_MARKET_API_URL=http://127.0.0.1:8010" >> .env

# 4. Install dependencies and start
npm install
npm run dev
```

Open **http://localhost:8080** in your browser.

> ⚠️ Both backend and frontend must be running at the same time.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Service status |
| POST | `/chat` | AI chatbot |
| GET | `/get-data` | Raw market data |
| GET | `/risk/latest` | Latest risk prediction |
| GET | `/risk/history` | Historical risk data |
| GET | `/risk/all` | Risk for all symbols |
| GET | `/dashboard/assets` | Asset cards data |
| GET | `/dashboard/candles` | Candlestick chart data |
| GET | `/graph/price` | Price chart (PNG) |
| GET | `/graph/risk` | Risk chart (PNG) |

Interactive API docs available at: **http://127.0.0.1:8010/docs**

---

## 🧠 Machine Learning Pipeline

```
data_collector.py       → Fetch 365 days of OHLCV data from Yahoo Finance
      ↓
feature_engineering.py  → Calculate daily returns, 7d volatility, MA7, MA30
      ↓
train.py                → Train Isolation Forest + Logistic Regression → save .pkl
      ↓
risk_engine.py          → Run predictions → store in market_risk_predictions table
      ↓
main.py / chatbot       → Serve results via API and AI explanations
```

### Models
- **Isolation Forest** → Anomaly detection (1=normal, -1=anomaly)
- **Logistic Regression** → Risk classification (0=LOW, 1=HIGH)

---

## 💬 Chatbot Examples

```
"Is Bitcoin safe right now?"
"What is the risk for AAPL?"
"Compare ETH and BTC"
"Show me the trend for Tesla over the last 7 days"
"What is volatility?"
```

The chatbot recognizes common names:
- Bitcoin / BTC → BTC-USD
- Ethereum / ETH → ETH-USD
- Apple → AAPL
- Tesla → TSLA
- Euro / EUR → EURUSD=X

---

## 📈 Supported Assets

| Symbol | Name | Category |
|--------|------|----------|
| BTC-USD | Bitcoin | Cryptocurrency |
| ETH-USD | Ethereum | Cryptocurrency |
| AAPL | Apple Inc. | Stock |
| TSLA | Tesla Inc. | Stock |
| EURUSD=X | EUR/USD | Forex |

---

## 🔐 Security

- Groq API key stored in `.env` (never committed to GitHub)
- `.env` and database files are in `.gitignore`
- GitHub Push Protection enabled to prevent secret leaks

---

## 🗺️ Roadmap

- [ ] Portfolio simulation (input your own holdings)
- [ ] Explainable AI with bullet points and percentages
- [ ] Real-time price updates
- [ ] Mobile-responsive improvements

---

## 👩‍💻 Authors

- **Tesnim** — Backend, ML pipeline, AI chatbot
- **Anas** — Backend , Frontend
- **Islem**_Frontend design and React components

---

## 📄 License

This project was developed as an academic project at **Université Internationale de Tunis (UIT)** — Software Engineering Department.

> ⚠️ **Disclaimer:** AegisAI is an educational project. All outputs are for informational purposes only and do not constitute financial advice.
