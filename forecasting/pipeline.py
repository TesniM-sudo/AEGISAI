from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
from sqlalchemy.engine import Engine

from .features import build_forecast_features
from .inference import predict_latest_probabilities
from .targets import TARGET_COLUMNS, build_forward_targets
from .training import TrainConfig, train_calibrated_models


DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "forecast_models"


def _models_present(model_dir: Path) -> bool:
    if not model_dir.exists():
        return False
    if not (model_dir / "metadata.joblib").exists():
        return False
    return all((model_dir / f"{t}.joblib").exists() for t in TARGET_COLUMNS)


def run_forecast_pipeline(
    engine: Engine,
    model_dir: str | Path = DEFAULT_MODEL_DIR,
    force_train: bool = False,
    train_config: TrainConfig | None = None,
) -> Dict[str, Any]:
    """Train (if needed) and persist latest forecast probabilities."""
    model_path = Path(model_dir)
    raw = pd.read_sql("SELECT * FROM market_data_features", engine)
    df_features, feature_spec = build_forecast_features(raw)
    df_labeled, meta = build_forward_targets(df_features, feature_spec)
    df_labeled = df_labeled.sort_values([feature_spec.timestamp_col, feature_spec.symbol_col]).reset_index(drop=True)

    if force_train or not _models_present(model_path):
        train_calibrated_models(
            df=df_labeled,
            feature_cols=feature_spec.feature_cols,
            target_cols=TARGET_COLUMNS,
            model_dir=model_path,
            config=train_config or TrainConfig(),
        )

    timestamp, probs = predict_latest_probabilities(engine, model_dir=model_path, df_source=raw)
    return {"timestamp": timestamp, "probabilities_by_symbol": probs, "label_meta": meta}
