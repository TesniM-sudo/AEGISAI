from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import numpy as np
import pandas as pd
from joblib import dump, load
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit


@dataclass(frozen=True)
class TrainConfig:
    c: float = 0.5
    penalty: str = "l2"
    max_iter: int = 1000
    class_weight_pos: int = 5
    n_splits: int = 5
    random_state: int = 42
    calibration_method: str = "isotonic"
    min_train_positives_per_fold: int = 1


class ConstantProbabilityModel:
    """Fallback model used when a target has no positives in time-based folds.

    It mimics a sklearn classifier by implementing `predict_proba`.
    """

    def __init__(self, probability: float):
        self.probability = float(probability)

    def predict_proba(self, X):  # noqa: N802 - sklearn-style API
        n = int(getattr(X, "shape", [len(X)])[0])
        p = float(min(max(self.probability, 0.0), 1.0))
        return np.column_stack([np.full(n, 1.0 - p), np.full(n, p)])


def _safe_int(value: Any) -> int:
    try:
        return int(value)
    except Exception:
        return 0


def _resolve_splits(n_samples: int, desired_splits: int) -> int:
    # TimeSeriesSplit requires n_splits < n_samples
    if n_samples < 10:
        return 2
    return max(2, min(desired_splits, n_samples - 1))


def _evaluate_binary(y_true: np.ndarray, y_prob: np.ndarray) -> Dict[str, float | None]:
    if len(np.unique(y_true)) < 2:
        return {"roc_auc": None, "pr_auc": None, "brier": None}
    return {
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
        "pr_auc": float(average_precision_score(y_true, y_prob)),
        "brier": float(brier_score_loss(y_true, y_prob)),
    }


def train_calibrated_models(
    df: pd.DataFrame,
    feature_cols: Iterable[str],
    target_cols: Iterable[str],
    model_dir: str | Path,
    config: TrainConfig | None = None,
) -> Dict[str, Any]:
    cfg = config or TrainConfig()
    model_path = Path(model_dir)
    model_path.mkdir(parents=True, exist_ok=True)

    X = df[list(feature_cols)].to_numpy(dtype=float)
    results: Dict[str, Any] = {"config": asdict(cfg), "targets": {}}

    for target in target_cols:
        y = df[target].to_numpy(dtype=int)

        base = LogisticRegression(
            penalty=cfg.penalty,
            C=cfg.c,
            max_iter=cfg.max_iter,
            class_weight={0: 1, 1: cfg.class_weight_pos},
            solver="lbfgs",
        )

        n_splits = _resolve_splits(len(df), cfg.n_splits)
        tscv = TimeSeriesSplit(n_splits=n_splits)

        # Filter splits where training window has both classes.
        splits = []
        for train_idx, test_idx in tscv.split(X):
            y_train = y[train_idx]
            unique = np.unique(y_train)
            if len(unique) < 2:
                continue
            if int(np.sum(y_train == 1)) < int(cfg.min_train_positives_per_fold):
                continue
            splits.append((train_idx, test_idx))

        # Calibrated probabilities (isotonic), with time-ordered CV.
        if len(np.unique(y)) < 2 or not splits:
            probability = float(np.mean(y))
            dump(ConstantProbabilityModel(probability), model_path / f"{target}.joblib")
            results["targets"][target] = {
                "positive_rate": probability,
                "samples": int(len(y)),
                "metrics_last_fold": {"roc_auc": None, "pr_auc": None, "brier": None},
                "note": "Trained fallback constant model (insufficient positives in time folds).",
            }
            continue

        calibrated = CalibratedClassifierCV(estimator=base, method=cfg.calibration_method, cv=splits)

        # Bonus metrics: evaluate on the last fold (pure forward test).
        metrics: Dict[str, float | None] = {"roc_auc": None, "pr_auc": None, "brier": None}
        try:
            train_idx, test_idx = splits[-1]
            n_inner_splits = _resolve_splits(len(train_idx), max(2, min(3, n_splits)))
            inner = TimeSeriesSplit(n_splits=n_inner_splits)
            calibrated_for_eval = CalibratedClassifierCV(
                estimator=base,
                method=cfg.calibration_method,
                cv=inner,
            )
            calibrated_for_eval.fit(X[train_idx], y[train_idx])
            prob = calibrated_for_eval.predict_proba(X[test_idx])[:, 1]
            metrics = _evaluate_binary(y[test_idx], prob)
        except Exception:
            metrics = {"roc_auc": None, "pr_auc": None, "brier": None}

        calibrated.fit(X, y)

        dump(calibrated, model_path / f"{target}.joblib")
        results["targets"][target] = {
            "positive_rate": float(np.mean(y)),
            "samples": int(len(y)),
            "metrics_last_fold": metrics,
        }

    dump({"feature_cols": list(feature_cols), "target_cols": list(target_cols)}, model_path / "metadata.joblib")
    (model_path / "metrics.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    return results


def load_models(model_dir: str | Path, target_cols: Iterable[str]) -> Dict[str, Any]:
    model_path = Path(model_dir)
    models: Dict[str, Any] = {}
    for target in target_cols:
        models[target] = load(model_path / f"{target}.joblib")
    return models


def load_metadata(model_dir: str | Path) -> Dict[str, Any]:
    model_path = Path(model_dir)
    return load(model_path / "metadata.joblib")
