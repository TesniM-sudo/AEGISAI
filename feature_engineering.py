import pandas as pd
from sqlalchemy.orm import sessionmaker
from database import engine, MarketData

Session = sessionmaker(bind=engine)
session = Session()

# 1️⃣ Read all data from DB
df = pd.read_sql(session.query(MarketData).statement, session.bind)

# 2️⃣ Sort by symbol and date
df = df.sort_values(by=["symbol", "date"])

# 3️⃣ Feature calculations
features = []

for symbol, group in df.groupby("symbol"):
    group = group.copy()
    group["daily_return"] = group["close"].pct_change()  # daily returns
    group["volatility_7d"] = group["daily_return"].rolling(7).std()  # 7-day rolling volatility
    group["ma_7d"] = group["close"].rolling(7).mean()  # 7-day moving average
    group["ma_30d"] = group["close"].rolling(30).mean()  # 30-day moving average
    features.append(group)

df_features = pd.concat(features)

# Optional: Save as new table in DB
df_features.to_sql("market_data_features", con=engine, if_exists="replace", index=False)

print("Feature engineering complete!")