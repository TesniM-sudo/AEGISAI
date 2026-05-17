from pathlib import Path

import joblib

BASE_DIR = Path(__file__).resolve().parent

# Load models once using paths relative to this file, not the shell cwd.
logistic_model = joblib.load(BASE_DIR / "logistic_model.pkl")
iso_model = joblib.load(BASE_DIR / "isolation_model.pkl")


def predict_risk(features: list) -> int:
    """
    Predict risk using logistic regression.
    Args:
        features (list): [amount, transactions_per_day, account_age_days]
    Returns:
        int: 0 or 1
    """
    return int(logistic_model.predict([features])[0])


def predict_anomaly(features: list) -> int:
    """
    Predict anomaly using Isolation Forest.
    Args:
        features (list): same as above
    Returns:
        int: -1 anomaly, 1 normal
    """
    return int(iso_model.predict([features])[0])
