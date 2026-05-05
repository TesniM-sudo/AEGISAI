from __future__ import annotations

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


class DecisionFeedbackRequest(BaseModel):
    """Feedback hook to update RL + incremental learning.

    Typical flow:
      1) Client asks `/chat` about a symbol
      2) Client reads `structured_data[symbol].decision` and sends back feedback

    You can provide either explicit `state/action/...` OR just a `symbol`.
    When omitted, the server recomputes the latest decision from the latest forecast.
    """

    symbol: str = Field(..., min_length=1, description="Asset symbol (e.g., TSLA, BTC-USD)")

    # RL fields (optional; if missing, server recomputes from latest forecast)
    state: Optional[int] = Field(default=None, ge=0, le=2)
    action: Optional[int] = Field(default=None, ge=0, le=2)
    next_state: Optional[int] = Field(default=None, ge=0, le=2)
    reward: Optional[float] = Field(default=None, description="Reward signal; if omitted, can be auto-derived")

    # Incremental learning label (optional): 1=risky, 0=not risky
    label_risky: Optional[int] = Field(default=None, ge=0, le=1)

    # If true and reward/next_state not provided, derive from the 2 most recent forecasts.
    auto_reward: bool = Field(default=True)


class DecisionFeedbackResponse(BaseModel):
    ok: bool
    updated_rl: bool = False
    updated_incremental: bool = False
    details: Dict[str, Any] = Field(default_factory=dict)
