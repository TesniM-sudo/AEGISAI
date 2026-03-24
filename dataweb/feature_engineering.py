import pandas as pd
from sqlalchemy.orm import sessionmaker
from database import engine, MarketData

PREDICTION_HORIZON = 30

Session = sessionmaker(bind=engine)
session = Session()

# Read all market data
df = pd.read_sql(session.query(MarketData).statement, session.bind)

# Sort correctly
df = df.sort_values(by=["symbol", "date"]).copy()

features = []

for symbol, group in df.groupby("symbol"):
    group = group.copy()
    group = group.sort_values("date")

    # Current features
    group["daily_return"] = group["close"].pct_change()
    group["volatility_7d"] = group["daily_return"].rolling(7).std()
    group["ma_7d"] = group["close"].rolling(7).mean()
    group["ma_30d"] = group["close"].rolling(30).mean()

    # Extra useful features for later model training
    group["close_vs_ma7"] = group["close"] / group["ma_7d"]
    group["close_vs_ma30"] = group["close"] / group["ma_30d"]
    group["ma7_vs_ma30"] = group["ma_7d"] / group["ma_30d"]

    # 30-day future target
    group["future_close_30d"] = group["close"].shift(-PREDICTION_HORIZON)
    group["future_return_30d"] = (
        group["future_close_30d"] - group["close"]
    ) / group["close"]

    group["target_30d"] = (group["future_return_30d"] > 0).astype("Int64")

    # Last 30 rows do not have future data, so target should be missing there
    group.loc[group["future_close_30d"].isna(), "target_30d"] = pd.NA

    features.append(group)

df_features = pd.concat(features, ignore_index=True)

# Save to DB
df_features.to_sql("market_data_features", con=engine, if_exists="replace", index=False)

print("Feature engineering with 30-day target complete!")
print(df_features[[
    "symbol", "date", "close",
    "daily_return", "volatility_7d", "ma_7d", "ma_30d",
    "future_close_30d", "future_return_30d", "target_30d"
]].tail(10))