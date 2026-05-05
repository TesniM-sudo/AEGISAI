from __future__ import annotations

"""Incremental (online) decision-risk model.

This module learns a lightweight mapping:
    forecast probabilities -> "is the situation risky?"

It is intentionally separate from the forecasting models. It consumes the
forecast outputs (drawdown/vol spike/anomaly probabilities) and learns online
via `partial_fit` to adapt over time.
"""

from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from joblib import dump, load
from sklearn.linear_model import SGDClassifier
from sklearn.preprocessing import StandardScaler


PROJECT_DIR = Path(__file__).resolve().parent
MODEL_DIR = PROJECT_DIR / "decision_models"
MODEL_PATH = MODEL_DIR / "incremental_sgd.joblib"

_CACHED = None


def _new_model() -> dict:
    # NOTE: StandardScaler supports partial_fit, so we can scale streaming data.
    scaler = StandardScaler(with_mean=True, with_std=True)
    clf = SGDClassifier(
        loss="log_loss",  # probabilistic logistic regression via SGD
        penalty="l2",
        alpha=1e-4,
        random_state=42,
        max_iter=1,  # we'll drive updates via partial_fit
        learning_rate="optimal",
        tol=None,
    )
    return {"scaler": scaler, "clf": clf, "initialized": False}


def load_model() -> dict:
    """Load the incremental model bundle (scaler + classifier).

    Where incremental learning happens:
        - `update_model()` calls `partial_fit()` on the scaler and classifier.
    """
    global _CACHED
    if _CACHED is not None:
        return _CACHED

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists():
        _CACHED = load(MODEL_PATH)
        return _CACHED

    _CACHED = _new_model()
    dump(_CACHED, MODEL_PATH)
    return _CACHED


def _as_2d(X: Sequence[Sequence[float]] | np.ndarray) -> np.ndarray:
    arr = np.asarray(X, dtype=float)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    return arr


def predict_decision_risk(features: Sequence[float] | np.ndarray) -> float:
    """Return P(risky=1) given forecast-derived feature vector.

    Features are expected to be:
        [drawdown_prob, vol_spike_prob, anomaly_prob]
    """
    bundle = load_model()
    X = _as_2d(features)

    if not bundle.get("initialized", False):
        # No training yet. Return a neutral-ish baseline.
        return 0.5

    Xs = bundle["scaler"].transform(X)
    prob = bundle["clf"].predict_proba(Xs)[:, 1][0]
    return float(prob)


def update_model(X: Sequence[Sequence[float]] | np.ndarray, y: Iterable[int]) -> None:
    """Online update with new labeled examples.

    Where incremental learning happens:
        - `StandardScaler.partial_fit` updates scaling statistics
        - `SGDClassifier.partial_fit` updates the classifier online
    """
    bundle = load_model()
    X_arr = _as_2d(X)
    y_arr = np.asarray(list(y), dtype=int)

    bundle["scaler"].partial_fit(X_arr)
    Xs = bundle["scaler"].transform(X_arr)

    if not bundle.get("initialized", False):
        bundle["clf"].partial_fit(Xs, y_arr, classes=np.array([0, 1], dtype=int))
        bundle["initialized"] = True
    else:
        bundle["clf"].partial_fit(Xs, y_arr)

    dump(bundle, MODEL_PATH)

