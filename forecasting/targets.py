from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from .features import FeatureSpec


@dataclass(frozen=True)
class TargetSpec:
    drawdown_7d_threshold: float = 0.05
    drawdown_30d_threshold: float = 0.10
    vol_spike_multiplier: float = 1.5
    isolation_contamination: float = 0.05
    random_state: int = 42


TARGET_COLUMNS: Tuple[str, ...] = (
    "drawdown_7d",
    "drawdown_30d",
    "vol_spike_7d",
    "vol_spike_30d",
    "anomaly_7d",
    "anomaly_30d",
)


def _forward_min(values: np.ndarray, horizon: int) -> np.ndarray:
    n = len(values)
    out = np.full(n, np.nan, dtype=float)
    for i in range(n):
        start = i + 1
        end = start + horizon
        if end <= n:
            out[i] = float(np.min(values[start:end]))
    return out


def _forward_std(values: np.ndarray, horizon: int) -> np.ndarray:
    n = len(values)
    out = np.full(n, np.nan, dtype=float)
    for i in range(n):
        start = i + 1
        end = start + horizon
        if end <= n:
            window = values[start:end]
            if np.all(np.isfinite(window)):
                out[i] = float(np.std(window))
    return out


def _forward_any(flags: np.ndarray, horizon: int) -> np.ndarray:
    n = len(flags)
    out = np.full(n, np.nan, dtype=float)
    for i in range(n):
        start = i + 1
        end = start + horizon
        if end <= n:
            out[i] = float(np.any(flags[start:end] == 1))
    return out


def build_forward_targets(
    df_features: pd.DataFrame,
    feature_spec: FeatureSpec,
    target_spec: TargetSpec | None = None,
) -> tuple[pd.DataFrame, Dict[str, float]]:
    """Attach forward-looking binary labels to the feature frame."""
    if df_features is None or df_features.empty:
        raise ValueError("No feature data available to build targets.")

    spec = target_spec or TargetSpec()
    df = df_features.copy()

    # --- Anomaly base flag (IsolationForest) ---
    X_anom = df[list(feature_spec.feature_cols)].to_numpy()
    iso = IsolationForest(
        n_estimators=200,
        contamination=spec.isolation_contamination,
        random_state=spec.random_state,
    )
    iso_pred = iso.fit_predict(X_anom)
    df["anomaly_flag"] = (iso_pred == -1).astype(int)

    # --- Forward labels per symbol ---
    for col in TARGET_COLUMNS:
        df[col] = np.nan

    for symbol, group_idx in df.groupby(feature_spec.symbol_col, sort=False).groups.items():
        idx = np.asarray(list(group_idx), dtype=int)
        close = df.loc[idx, feature_spec.close_col].to_numpy(dtype=float)
        ret_1d = df.loc[idx, "ret_1d"].to_numpy(dtype=float)
        vol_30d = df.loc[idx, "vol_30d"].to_numpy(dtype=float)
        anomaly_flag = df.loc[idx, "anomaly_flag"].to_numpy(dtype=int)

        future_min_7d = _forward_min(close, 7)
        future_min_30d = _forward_min(close, 30)
        dd7 = np.where(
            np.isfinite(future_min_7d),
            (future_min_7d <= (close * (1.0 - spec.drawdown_7d_threshold))).astype(int),
            np.nan,
        )
        dd30 = np.where(
            np.isfinite(future_min_30d),
            (future_min_30d <= (close * (1.0 - spec.drawdown_30d_threshold))).astype(int),
            np.nan,
        )
        df.loc[idx, "drawdown_7d"] = dd7
        df.loc[idx, "drawdown_30d"] = dd30

        future_vol_7d = _forward_std(ret_1d, 7)
        future_vol_30d = _forward_std(ret_1d, 30)

        vs7 = np.where(
            np.isfinite(future_vol_7d) & np.isfinite(vol_30d),
            (future_vol_7d > (spec.vol_spike_multiplier * vol_30d)).astype(int),
            np.nan,
        )
        vs30 = np.where(
            np.isfinite(future_vol_30d) & np.isfinite(vol_30d),
            (future_vol_30d > (spec.vol_spike_multiplier * vol_30d)).astype(int),
            np.nan,
        )
        df.loc[idx, "vol_spike_7d"] = vs7
        df.loc[idx, "vol_spike_30d"] = vs30

        df.loc[idx, "anomaly_7d"] = _forward_any(anomaly_flag, 7)
        df.loc[idx, "anomaly_30d"] = _forward_any(anomaly_flag, 30)

    df = df.dropna(subset=list(TARGET_COLUMNS)).reset_index(drop=True)
    df[list(TARGET_COLUMNS)] = df[list(TARGET_COLUMNS)].astype(int)

    meta = {
        "drawdown_7d_threshold": spec.drawdown_7d_threshold,
        "drawdown_30d_threshold": spec.drawdown_30d_threshold,
        "vol_spike_multiplier": spec.vol_spike_multiplier,
        "isolation_contamination": spec.isolation_contamination,
    }
    return df, meta
