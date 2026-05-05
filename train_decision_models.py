from __future__ import annotations

"""Lightweight training utilities for decision-making layers.

This file does NOT touch the forecasting models. It uses stored forecast outputs
(`market_risk_forecasts`) to:
  - warm-start the incremental online model (SGDClassifier)
  - train the RL Q-table from historical forecast transitions
"""

from typing import Any, Dict, List

import numpy as np

from database import engine
from forecasting.db import get_recent_forecasts
from incremental_model import update_model
from reward_engine import compute_reward, forecast_to_state
from rl_agent import choose_action, load_q_table, update_q


def _risk_sum(f: Dict[str, Any]) -> float:
    return float(f.get("drawdown_7d", 0.0) or 0.0) + float(f.get("vol_spike_7d", 0.0) or 0.0) + float(f.get("anomaly_7d", 0.0) or 0.0)


def warm_start_incremental_from_forecasts(symbol: str, limit: int = 5000, risky_threshold: float = 0.7) -> Dict[str, Any]:
    """Warm-start the incremental model using historical forecasts.

    Labeling strategy (lightweight heuristic):
      y = 1 (risky) if drawdown_7d + vol_spike_7d + anomaly_7d >= risky_threshold else 0
    """
    rows = get_recent_forecasts(engine, symbol=symbol, limit=limit)
    if not rows:
        return {"ok": False, "error": f"No forecast rows found for {symbol}."}

    rows = list(reversed(rows))  # oldest -> newest
    X: List[List[float]] = []
    y: List[int] = []
    for f in rows:
        X.append([float(f.get("drawdown_7d") or 0.0), float(f.get("vol_spike_7d") or 0.0), float(f.get("anomaly_7d") or 0.0)])
        y.append(1 if _risk_sum(f) >= float(risky_threshold) else 0)

    update_model(X, y)
    return {"ok": True, "samples": len(y), "positive_rate": float(np.mean(y))}


def train_rl_from_forecast_history(symbol: str, limit: int = 5000, epsilon: float = 0.1, seed: int = 42) -> Dict[str, Any]:
    """Train the Q-table from consecutive forecast transitions.

    We treat the forecast sequence as environment states:
      s_t      = forecast at time t
      s_{t+1}  = forecast at time t+1
      r_t      = compute_reward(s_t, s_{t+1}, action_t)
    """
    rows = get_recent_forecasts(engine, symbol=symbol, limit=limit)
    if len(rows) < 2:
        return {"ok": False, "error": f"Need at least 2 forecast rows for {symbol}."}

    rows = list(reversed(rows))  # oldest -> newest
    np.random.seed(int(seed))

    updates = 0
    rewards: List[float] = []
    for prev_f, next_f in zip(rows, rows[1:]):
        state = forecast_to_state(prev_f)
        action = choose_action(state, epsilon=epsilon)
        reward = compute_reward(prev_f, next_f, action=action)
        next_state = forecast_to_state(next_f)
        update_q(state, action, reward, next_state)
        updates += 1
        rewards.append(float(reward))

    q = load_q_table()
    return {
        "ok": True,
        "transitions": updates,
        "avg_reward": float(np.mean(rewards)) if rewards else 0.0,
        "q_table": q.tolist(),
    }


if __name__ == "__main__":
    # Example usage:
    print(warm_start_incremental_from_forecasts("TSLA"))
    print(train_rl_from_forecast_history("TSLA"))
