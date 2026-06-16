import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import IsolationForest

# --- Dummy training data (replace with your real dataset later) ---
X = np.array([
    [100, 2, 365],
    [5000, 15, 30],
    [250, 3, 200],
    [9000, 20, 10],
    [80, 1, 500],
])
y = [0, 1, 0, 1, 0]  # 0 = low risk, 1 = high risk

# --- Train models ---
logistic_model = LogisticRegression()
logistic_model.fit(X, y)

iso_model = IsolationForest(contamination=0.2, random_state=42)
iso_model.fit(X)

# --- Save models ---
joblib.dump(logistic_model, "logistic_model.pkl")
joblib.dump(iso_model, "isolation_model.pkl")

print("Models saved successfully.")