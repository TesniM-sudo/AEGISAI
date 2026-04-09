from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import API_TITLE
from finance_assistant import FinanceAssistant
from schemas import ChatRequest, ChatResponse
from routes import account

app = FastAPI(title=API_TITLE)
assistant = FinanceAssistant()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(account.router)


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
