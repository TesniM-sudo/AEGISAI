from pathlib import Path

from sqlalchemy import create_engine, Column, Integer, String, Float, Date, UniqueConstraint
from sqlalchemy.orm import declarative_base

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "aegisai.db"

# Create SQLite database using an absolute path so npm/vite cwd does not matter.
engine = create_engine(f"sqlite:///{DB_PATH.as_posix()}", echo=False)

# Define Base
Base = declarative_base()


# Define Market Data table
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

    # Prevents duplicate (symbol + date) entries
    __table_args__ = (
        UniqueConstraint("symbol", "date", name="uq_symbol_date"),
    )

    def __repr__(self):
        return f"<MarketData(symbol={self.symbol}, date={self.date}, close={self.close})>"


# Create table if it doesn't exist
if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("Database and table created successfully!")
