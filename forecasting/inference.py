from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd
from sqlalchemy.engine import Engine

from .db import insert_forecast
from .features import FeatureSpec, build_forecast_features
from .targets import TARGET_COLUMNS
from .training import load_metadata, load_models


def _latest_rows_by_symbol(df: pd.DataFrame, feature_spec: FeatureSpec) -> pd.DataFrame:
    latest = (
        df.sort_values([feature_spec.symbol_col, feature_spec.timestamp_col])
        .groupby(feature_spec.symbol_col, as_index=False, sort=False)
        .tail(1)
    )
    if latest.empty:
        raise ValueError("No latest rows found for forecast inference.")
    return latest


def predict_latest_probabilities(
    engine: Engine,
    model_dir: str | Path,
    df_source: pd.DataFrame | None = None,
) -> Tuple[str, Dict[str, Dict[str, float]]]:
    """Compute probabilities for the latest available row per symbol and write to DB."""
    source = df_source
    if source is None:
        source = pd.read_sql("SELECT * FROM market_data_features", engine)

    df_features, feature_spec = build_forecast_features(source)

    meta = load_metadata(model_dir)
    feature_cols = meta["feature_cols"]
    target_cols = meta["target_cols"]
    models = load_models(model_dir, target_cols)

    latest_rows = _latest_rows_by_symbol(df_features, feature_spec)

    all_probs: Dict[str, Dict[str, float]] = {}
    max_timestamp = None

    for _, row in latest_rows.iterrows():
        symbol = str(row[feature_spec.symbol_col])
        X_latest = row[feature_cols].to_numpy(dtype=float).reshape(1, -1)

        probs: Dict[str, float] = {}
        for target in TARGET_COLUMNS:
            model = models[target]
            prob = float(model.predict_proba(X_latest)[:, 1][0])
            probs[target] = prob

        timestamp = pd.to_datetime(row[feature_spec.timestamp_col]).isoformat()
        if max_timestamp is None or timestamp > max_timestamp:
            max_timestamp = timestamp

        insert_forecast(engine, timestamp=timestamp, probs=probs, symbol=symbol)
        all_probs[symbol] = probs

    if not max_timestamp:
        raise ValueError("Unable to compute a forecast timestamp.")
    return max_timestamp, all_probs
