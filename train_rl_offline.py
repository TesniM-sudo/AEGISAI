from __future__ import annotations

"""Example: offline-train the RL policy and evaluate it.

Run (from this repo root):
  python train_rl_offline.py --symbol TSLA --epochs 10

Notes:
  - Uses stored `market_risk_forecasts` if present.
  - Otherwise computes simple heuristic forecasts from historical prices.
  - Saves the trained Q-table to `decision_models/q_table.joblib`.
"""

import argparse

from rl_training import evaluate_policy, train_rl_on_history


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", default="TSLA")
    parser.add_argument("--epochs", type=int, default=8)
    args = parser.parse_args()

    print(f"Training offline RL on {args.symbol} for {args.epochs} epochs...")
    train_rl_on_history(args.symbol, epochs=args.epochs)
    evaluate_policy(args.symbol)


if __name__ == "__main__":
    main()
