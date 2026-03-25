import pandas as pd
from database import engine
from sklearn.ensemble import IsolationForest
import joblib

# 1) Load features
df = pd.read_sql("SELECT * FROM market_data_features", engine)

# 2) Select model features
model_cols = ["daily_return", "volatility_7d"]
X = df[model_cols].dropna()

# 3) Train model
model = IsolationForest(
    n_estimators=200,
    contamination=0.05,
    random_state=42
)
model.fit(X)

# 4) Predict anomalies
work = df.loc[X.index].copy()
work["anomaly"] = model.predict(X)  # -1 anomaly, 1 normal
work["risk_flag"] = (work["anomaly"] == -1).astype(int)

# 5) Convert anomaly “severity” to 0..100 score
# decision_function: higher = more normal; lower = more anomalous
severity = -model.decision_function(X)  # higher = more anomalous
# normalize to 0..100
sev_min, sev_max = float(severity.min()), float(severity.max())
if sev_max - sev_min < 1e-12:
    work["risk_score"] = 0.0
else:
    work["risk_score"] = ((severity - sev_min) / (sev_max - sev_min)) * 100.0

# 6) Store results
cols_to_store = [
    "symbol", "date", "close", "daily_return", "volatility_7d", "ma_7d", "ma_30d",
    "anomaly", "risk_flag", "risk_score"
]
work[cols_to_store].to_sql("market_risk_predictions", engine, if_exists="replace", index=False)

# 7) Save model
joblib.dump(model, "risk_model.pkl")

print("Risk model trained; predictions saved to market_risk_predictions.")