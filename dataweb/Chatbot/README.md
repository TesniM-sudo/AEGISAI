# AegisAI Chatbot MVP

This is a standalone chatbot backend folder for testing before integrating chat into the website.

It is intentionally **grounded on your SQLite database** and does **not** depend on a paid API.

## What it can do

- answer the latest risk for a symbol
- show a short trend summary for the last N days
- compare two assets by latest risk and price
- list supported symbols found in the database
- explain finance terms used in your project

## Project files

- `app.py` — FastAPI API for chatbot testing
- `schemas.py` — request/response models
- `db_tools.py` — SQLite access helpers
- `finance_assistant.py` — intent detection and answer generation
- `run_local.py` — simple launcher for local testing
- `test_chatbot.py` — small test suite
- `requirements.txt` — Python dependencies

## Setup

1. Create a virtual environment
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Make sure the SQLite database path points to your real project DB.

By default, this project expects the DB here:

```text
../AEGISAI-master/aegisai.db
```

If needed, change it in `config.py`.

## Run

```bash
python run_local.py
```

Then open:

- API docs: `http://127.0.0.1:8010/docs`
- health: `http://127.0.0.1:8010/health`

## Example messages

- `What is the latest risk for AAPL?`
- `Show me BTC-USD trend for the last 7 days`
- `Compare AAPL and BTC-USD`
- `List supported symbols`
- `Explain volatility`

## Notes

This MVP is reliable because it answers from your own project database.
Later, you can connect a local model like Ollama only for better wording, while keeping facts grounded in these same database tools.
