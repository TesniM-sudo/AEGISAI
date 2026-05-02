from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User chat message")
    user_id: Optional[str] = Field(default=None, description="User email for contextual chatbot replies")


class ChatResponse(BaseModel):
    reply: str
    intent: str
    symbols: List[str]
    structured_data: Dict[str, Any]


class PredictRequest(BaseModel):
    """Payload for lightweight risk prediction requests."""

    amount: float = Field(..., ge=0)
    transactions_per_day: int = Field(..., ge=0)
    account_age_days: int = Field(..., ge=0)
    user_id: Optional[str] = Field(default=None, description="User email used for alert notifications")
