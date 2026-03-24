from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User chat message")


class ChatResponse(BaseModel):
    reply: str
    intent: str
    symbols: List[str] = []
    structured_data: Optional[Dict[str, Any]] = None
    disclaimer: str = (
        "Educational project output only. This is not financial advice."
    )
