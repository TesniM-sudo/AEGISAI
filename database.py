from pathlib import Path

from sqlalchemy import Column, Date, Float, Integer, String, UniqueConstraint, create_engine
from sqlalchemy.orm import declarative_base

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "aegisai.db"

# Use an absolute path so npm/vite cwd does not affect the backend database.
engine = create_engine(f"sqlite:///{DB_PATH.as_posix()}", echo=False)

Base = declarative_base()


class MarketData(Base):
    __tablename__ = "market_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    asset_type = Column(String)

    __table_args__ = (
        UniqueConstraint("symbol", "date", name="uq_symbol_date"),
    )

    def __repr__(self):
        return f"<MarketData(symbol={self.symbol}, date={self.date}, close={self.close})>"


Base.metadata.create_all(engine)


if __name__ == "__main__":
    print("Database and table created successfully!")
