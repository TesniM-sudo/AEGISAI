from __future__ import annotations

"""Offline RL training utilities for AegisAI.

This file implements **offline** (a.k.a. batch) reinforcement learning for the
project's tabular Q-learning agent.

Key idea:
  We do NOT have a live trading environment in training. Instead, we simulate an
  environment by walking forward through a historical time-series and treating
  consecutive forecast snapshots as state transitions:

      s_t   = forecast probabilities at time t
      s_t+1 = forecast probabilities at time t+1

  The agent learns which actions (Invest/Hold/Diversify) tend to lead to *lower
  future risk signals*.

CPU-only, no deep learning.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import text

from database import engine
from reward_engine import compute_reward, forecast_to_state
from rl_agent import (
    ALPHA,
    GAMMA,
    N_ACTIONS,
    N_STATES,
    action_to_text,
    choose_action,
    load_q_table,
    save_q_table,
)


@dataclass(frozen=True)
class PolicyEval:
    steps: int
    total_reward: float
    avg_reward_per_step: float
    action_counts: Dict[str, int]
    safe_decision_pct: float


def _load_forecast_history_from_db(symbol: str) -> List[Dict[str, Any]]:
    """Load stored forecast rows for a symbol in chronological order.

    Uses the SQLite `market_risk_forecasts` table created by the forecasting
    pipeline.
    """
    sql = text(
        """
        SELECT
            timestamp,
            symbol,
            drawdown_7d,
            vol_spike_7d,
            anomaly_7d
        FROM market_risk_forecasts
        WHERE symbol IS NOT NULL AND UPPER(symbol) = UPPER(:symbol)
        ORDER BY timestamp ASC, id ASC
        """
    )
    with engine.begin() as conn:
        rows = conn.execute(sql, {"symbol": symbol}).mappings().all()
    return [dict(r) for r in rows]


def _compute_simple_forecasts_from_prices(symbol: str) -> List[Dict[str, Any]]:
    """Fallback: compute simple probability-like signals from historical prices.

    This is NOT a full forecasting model. It's a lightweight heuristic so offline
    RL training can run even if the dedicated forecast pipeline hasn't been run.

    Signals are derived only from past data at each step, to mimic a causal model.
    """
    sql = text(
        """
        SELECT date, close
        FROM market_data
        WHERE UPPER(symbol) = UPPER(:symbol)
        ORDER BY date ASC
        """
    )
    with engine.begin() as conn:
        df = pd.read_sql(sql, conn, params={"symbol": symbol})

    if df.empty or len(df) < 40:
        return []

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")
    df["ret"] = df["close"].pct_change().fillna(0.0)

    # Rolling, causal features.
    df["vol_7"] = df["ret"].rolling(7, min_periods=7).std()
    df["vol_30"] = df["ret"].rolling(30, min_periods=30).std()

    # Recent drawdown proxy: how far price is below the last 7d high.
    df["max_7"] = df["close"].rolling(7, min_periods=7).max()
    df["dd_7"] = (df["max_7"] - df["close"]) / df["max_7"]

    # Anomaly proxy: absolute z-score of daily return over a 30d window.
    roll_mean = df["ret"].rolling(30, min_periods=30).mean()
    roll_std = df["ret"].rolling(30, min_periods=30).std().replace(0.0, np.nan)
    df["z_30"] = ((df["ret"] - roll_mean) / roll_std).abs()

    # Convert proxies into [0,1] pseudo-probabilities.
    def _clip01(x: float) -> float:
        return float(max(0.0, min(1.0, x)))

    forecasts: List[Dict[str, Any]] = []
    for row in df.itertuples(index=False):
        if pd.isna(row.vol_7) or pd.isna(row.vol_30) or pd.isna(row.dd_7) or pd.isna(row.z_30):
            continue

        drawdown_7d = _clip01(float(row.dd_7) / 0.05)  # 5% drawdown ~= 1.0
        vol_ratio = float(row.vol_7) / float(row.vol_30) if float(row.vol_30) > 0 else 1.0
        vol_spike_7d = _clip01((vol_ratio - 1.0) / 0.5)  # 50% vol increase ~= 1.0
        anomaly_7d = _clip01(float(row.z_30) / 3.0)  # 3-sigma ~= 1.0

        forecasts.append(
            {
                "timestamp": row.date.isoformat(),
                "symbol": symbol,
                "drawdown_7d": drawdown_7d,
                "vol_spike_7d": vol_spike_7d,
                "anomaly_7d": anomaly_7d,
            }
        )

    return forecasts


def _load_training_sequence(symbol: str) -> List[Dict[str, Any]]:
    """Load a chronological sequence of forecast-like dicts for offline RL."""
    rows = _load_forecast_history_from_db(symbol)
    if len(rows) >= 40:
        return rows

    # Fallback to heuristics derived from historical prices.
    rows = _compute_simple_forecasts_from_prices(symbol)
    return rows


def _linear_decay(step: int, total_steps: int, start: float, end: float) -> float:
    if total_steps <= 1:
        return float(end)
    frac = float(step) / float(total_steps - 1)
    return float(start + (end - start) * frac)


def train_rl_on_history(symbol: str, epochs: int = 8, epsilon_start: float = 0.5, epsilon_end: float = 0.05) -> None:
    """Offline-train the tabular Q-learning agent on a historical sequence.

    This runs a simple simulation loop over time-series transitions. The agent's
    state is derived from forecast probabilities, reward is computed from the
    *real* evolution of the risk signals, and Q-values are updated with the
    standard Q-learning update.

    After training, the Q-table is saved to `decision_models/q_table.joblib` and
    will be used automatically by `decision_engine.make_decision()`.
    """
    data = _load_training_sequence(symbol)
    if len(data) < 10:
        raise ValueError(
            f"Not enough data to train for {symbol}. "
            "Run the forecast pipeline (update_all.py) or ensure market_data has enough history."
        )

    # Load Q-table once and update it in-memory (fast); save at the end.
    q = load_q_table()
    if q.shape != (N_STATES, N_ACTIONS):
        raise ValueError(f"Unexpected Q-table shape: {q.shape}")

    steps_per_epoch = len(data) - 1
    total_steps = max(1, epochs * steps_per_epoch)
    global_step = 0

    for epoch in range(int(epochs)):
        for t in range(steps_per_epoch):
            current_forecast = data[t]
            next_forecast = data[t + 1]

            # Epsilon decay: explore early, exploit later.
            epsilon = _linear_decay(global_step, total_steps, epsilon_start, epsilon_end)

            state = forecast_to_state(current_forecast)
            action = choose_action(state, epsilon=epsilon)
            reward = compute_reward(current_forecast, next_forecast, action=action)
            next_state = forecast_to_state(next_forecast)

            # Q-learning update in-place (avoids joblib dump on every step).
            s = int(np.clip(state, 0, N_STATES - 1))
            a = int(np.clip(action, 0, N_ACTIONS - 1))
            ns = int(np.clip(next_state, 0, N_STATES - 1))

            td_target = float(reward) + float(GAMMA) * float(np.max(q[ns]))
            td_error = td_target - float(q[s, a])
            q[s, a] = float(q[s, a]) + float(ALPHA) * td_error

            global_step += 1

    save_q_table(q)


def evaluate_policy(symbol: str) -> PolicyEval:
    """Evaluate the learned policy on historical data without updating Q."""
    data = _load_training_sequence(symbol)
    if len(data) < 10:
        raise ValueError(f"Not enough data to evaluate for {symbol}.")

    q = load_q_table()

    total_reward = 0.0
    action_counts = {"Invest": 0, "Hold": 0, "Diversify": 0}
    safe_count = 0

    for t in range(len(data) - 1):
        current_forecast = data[t]
        next_forecast = data[t + 1]

        state = forecast_to_state(current_forecast)

        # Pure exploitation for evaluation.
        s = int(np.clip(state, 0, N_STATES - 1))
        action = int(np.argmax(q[s]))

        reward = compute_reward(current_forecast, next_forecast, action=action)
        total_reward += float(reward)

        action_name = action_to_text(action)
        action_counts[action_name] = int(action_counts.get(action_name, 0)) + 1

        # "Safe decision" heuristic aligned with project goal.
        #   high-risk  -> diversify
        #   low-risk   -> invest
        #   medium     -> hold
        if (state == 2 and action == 2) or (state == 0 and action == 0) or (state == 1 and action == 1):
            safe_count += 1

    steps = len(data) - 1
    avg = float(total_reward) / float(steps) if steps else 0.0
    safe_pct = (float(safe_count) / float(steps)) * 100.0 if steps else 0.0

    print(f"\n[POLICY EVAL] {symbol}")
    print(f"Steps: {steps}")
    print(f"Average reward per step: {avg:.4f}")
    print("Action distribution:")
    for k, v in action_counts.items():
        pct = (float(v) / float(steps)) * 100.0 if steps else 0.0
        print(f"  {k}: {v} ({pct:.1f}%)")
    print(f"Percentage of safe decisions: {safe_pct:.1f}%")

    return PolicyEval(
        steps=steps,
        total_reward=float(total_reward),
        avg_reward_per_step=avg,
        action_counts=action_counts,
        safe_decision_pct=safe_pct,
    )
