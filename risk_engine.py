import pandas as pd
from sklearn.ensemble import IsolationForest


def classify_risk(score):
    if score < 0.3:
        return "LOW"
    elif score < 0.6:
        return "MEDIUM"
    elif score < 0.8:
        return "HIGH"
    else:
        return "CRITICAL"


def train_model(features):
    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42
    )
    model.fit(features)
    return model


def compute_risk(model, X):
    anomaly_score = model.decision_function(X)[0]

    # Normalize score between 0 and 1
    risk_score = 1 - anomaly_score

    risk_level = classify_risk(risk_score)

    return risk_score, risk_level