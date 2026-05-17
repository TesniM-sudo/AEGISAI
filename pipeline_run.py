import pandas as pd
from database import engine
from risk_engine import train_model

# Load data
df = pd.read_sql("SELECT * FROM market_data_features", engine)

features = df[["daily_return", "volatility_7d"]].dropna()

# Train model
model = train_model(features)

# Predict anomalies
df = df.loc[features.index]
df["anomaly"] = model.predict(features)

df["risk_flag"] = df["anomaly"].apply(lambda x: 1 if x == -1 else 0)

# Save to DB
df.to_sql("market_risk_predictions", engine, if_exists="replace", index=False)