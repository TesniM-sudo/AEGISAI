from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Tuple

import numpy as np
import pandas as pd
from pandas.api.types import is_datetime64_any_dtype


@dataclass(frozen=True)
class FeatureSpec:
    timestamp_col: str
    symbol_col: str
    close_col: str
    volume_col: str
    feature_cols: Tuple[str, ...]


FORECAST_FEATURE_COLUMNS: Tuple[str, ...] = (
    # Returns & momentum
    "ret_1d",
    "ret_3d",
    "ret_7d",
    "ma_7d",
    "ma_30d",
    "momentum",
    # Volatility
    "vol_7d",
    "vol_30d",
    "vol_ratio",
    # Drawdown
    "rolling_max_30d",
    "drawdown",
    # Volume signals
    "volume_change",
    "volume_zscore",
    # Regime features
    "trend",
    "high_vol_regime",
    # Interactions
    "vol_drawdown",
    "momentum_vol",
)


def _resolve_column(df: pd.DataFrame, candidates: Iterable[str]) -> str | None:
    for name in candidates:
        if name in df.columns:
            return name
    return None


def _coerce_timestamp(series: pd.Series) -> pd.Series:
    # Avoid numpy dtype checks on pandas extension dtypes (e.g., StringDtype),
    # which can raise "Cannot interpret '<StringDtype(...)>' as a data type".
    if is_datetime64_any_dtype(series):
        return series
    return pd.to_datetime(series.astype("string"), errors="coerce")


def build_forecast_features(raw: pd.DataFrame) -> tuple[pd.DataFrame, FeatureSpec]:
    """Compute forward-forecast feature set.

    The input typically comes from the `market_data_features` table. The table
    historically used `date` (not `timestamp`), so we accept either.
    """
    if raw is None or raw.empty:
        raise ValueError("No data available to build forecast features.")

    df = raw.copy()

    timestamp_col = _resolve_column(df, ("timestamp", "date", "datetime", "time"))
    if not timestamp_col:
        raise ValueError("Expected a timestamp/date column in market_data_features.")

    close_col = _resolve_column(df, ("close", "Close"))
    if not close_col:
        raise ValueError("Expected a close column in market_data_features.")

    volume_col = _resolve_column(df, ("volume", "Volume"))
    if not volume_col:
        # Some earlier pipelines only stored price features. Use a constant so
        # volume-derived signals become neutral.
        df["volume"] = 1.0
        volume_col = "volume"

    symbol_col = _resolve_column(df, ("symbol", "ticker", "asset", "asset_symbol"))
    if not symbol_col:
        df["symbol"] = "GLOBAL"
        symbol_col = "symbol"

    df[timestamp_col] = _coerce_timestamp(df[timestamp_col])
    df = df.dropna(subset=[timestamp_col, close_col])

    df = df.sort_values([symbol_col, timestamp_col]).reset_index(drop=True)

    grouped = df.groupby(symbol_col, sort=False)

    # Returns & momentum
    df["ret_1d"] = grouped[close_col].pct_change(1)
    df["ret_3d"] = grouped[close_col].pct_change(3)
    df["ret_7d"] = grouped[close_col].pct_change(7)
    df["ma_7d"] = grouped[close_col].rolling(7).mean().reset_index(level=0, drop=True)
    df["ma_30d"] = grouped[close_col].rolling(30).mean().reset_index(level=0, drop=True)
    df["momentum"] = df[close_col] / df["ma_7d"]

    # Volatility
    df["vol_7d"] = grouped["ret_1d"].rolling(7).std().reset_index(level=0, drop=True)
    df["vol_30d"] = grouped["ret_1d"].rolling(30).std().reset_index(level=0, drop=True)
    df["vol_ratio"] = df["vol_7d"] / df["vol_30d"]

    # Drawdown
    df["rolling_max_30d"] = grouped[close_col].rolling(30).max().reset_index(level=0, drop=True)
    df["drawdown"] = (df[close_col] / df["rolling_max_30d"]) - 1.0

    # Volume signals
    df["volume_change"] = grouped[volume_col].pct_change(1)
    vol_mean_30d = grouped[volume_col].rolling(30).mean().reset_index(level=0, drop=True)
    vol_std_30d = grouped[volume_col].rolling(30).std().reset_index(level=0, drop=True)
    df["volume_zscore"] = (df[volume_col] - vol_mean_30d) / vol_std_30d.replace(0.0, np.nan)

    # Regime features
    df["trend"] = (df["ma_7d"] > df["ma_30d"]).astype(int)
    historical_mean_vol = grouped["vol_30d"].transform("mean")
    df["high_vol_regime"] = (df["vol_30d"] > historical_mean_vol).astype(int)

    # Interaction features
    df["vol_drawdown"] = df["vol_30d"] * df["drawdown"]
    df["momentum_vol"] = df["momentum"] * df["vol_30d"]

    # Clean numeric instabilities and drop NaNs after feature creation.
    df = df.replace([np.inf, -np.inf], np.nan)

    keep_cols: List[str] = [symbol_col, timestamp_col, close_col, volume_col, *FORECAST_FEATURE_COLUMNS]
    df = df.dropna(subset=keep_cols).reset_index(drop=True)

    # Standardize core column names for downstream modules.
    if symbol_col != "symbol":
        df = df.rename(columns={symbol_col: "symbol"})
        symbol_col = "symbol"
    if timestamp_col != "timestamp":
        df = df.rename(columns={timestamp_col: "timestamp"})
        timestamp_col = "timestamp"
    if close_col != "close":
        df = df.rename(columns={close_col: "close"})
        close_col = "close"
    if volume_col != "volume":
        df = df.rename(columns={volume_col: "volume"})
        volume_col = "volume"

    spec = FeatureSpec(
        timestamp_col=timestamp_col,
        symbol_col=symbol_col,
        close_col=close_col,
        volume_col=volume_col,
        feature_cols=FORECAST_FEATURE_COLUMNS,
    )
    return df, spec
