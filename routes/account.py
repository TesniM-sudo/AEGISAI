import json
from copy import deepcopy
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import BASE_DIR

router = APIRouter(prefix="/account", tags=["Account"])

STORE_PATH = Path(BASE_DIR) / "account_store.json"
STORE_LOCK = Lock()
DEFAULT_PASSWORD = "admin123"


class SessionData(BaseModel):
    email: str
    role: Literal["admin", "user"]


class Holding(BaseModel):
    symbol: str
    name: str
    quantity: float
    avgPrice: float


class PortfolioState(BaseModel):
    startingCash: float = 100000
    cash: float = 100000
    holdings: list[Holding] = Field(default_factory=list)


class AccountStateResponse(BaseModel):
    session: SessionData
    portfolio: PortfolioState


class AuthRequest(BaseModel):
    email: str
    password: str


class PortfolioSaveRequest(BaseModel):
    email: str
    portfolio: PortfolioState


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _default_role(email: str) -> Literal["admin", "user"]:
    return "admin" if _normalize_email(email) == "admin@aegisai.com" else "user"


def _default_portfolio() -> dict:
    return {
        "startingCash": 100000,
        "cash": 100000,
        "holdings": [],
    }


def _read_store() -> dict:
    if not STORE_PATH.exists():
        return {"accounts": {}}
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"accounts": {}}


def _write_store(store: dict) -> None:
    STORE_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def get_account_record(email: str) -> dict | None:
    """Return a stored account snapshot without creating a new one."""
    normalized_email = _normalize_email(email)
    with STORE_LOCK:
        store = _read_store()
        account = store.get("accounts", {}).get(normalized_email)
        return deepcopy(account) if account else None


def _ensure_account(email: str, password: str | None = None) -> dict:
    normalized_email = _normalize_email(email)
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        account = accounts.get(normalized_email)
        if account is None:
            account = {
                "email": normalized_email,
                "password": password or DEFAULT_PASSWORD,
                "role": _default_role(normalized_email),
                "portfolio": _default_portfolio(),
            }
            accounts[normalized_email] = account
            _write_store(store)
        return account


def _account_response(account: dict) -> AccountStateResponse:
    return AccountStateResponse(
        session=SessionData(email=account["email"], role=account["role"]),
        portfolio=PortfolioState(**account["portfolio"]),
    )


@router.post("/login", response_model=AccountStateResponse)
def login(payload: AuthRequest):
    account = _ensure_account(payload.email, payload.password.strip() or DEFAULT_PASSWORD)
    if account["password"] != payload.password.strip():
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return _account_response(account)


@router.post("/register", response_model=AccountStateResponse)
def register(payload: AuthRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        if normalized_email in accounts:
            raise HTTPException(status_code=409, detail="Account already exists.")
        account = {
            "email": normalized_email,
            "password": payload.password.strip() or DEFAULT_PASSWORD,
            "role": _default_role(normalized_email),
            "portfolio": _default_portfolio(),
        }
        accounts[normalized_email] = account
        _write_store(store)
    return _account_response(account)


@router.get("/portfolio", response_model=PortfolioState)
def get_portfolio(email: str):
    account = _ensure_account(email)
    return PortfolioState(**account["portfolio"])


@router.post("/portfolio", response_model=PortfolioState)
def save_portfolio(payload: PortfolioSaveRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        account = accounts.get(normalized_email)
        if account is None:
            account = {
                "email": normalized_email,
                "password": DEFAULT_PASSWORD,
                "role": _default_role(normalized_email),
                "portfolio": _default_portfolio(),
            }
            accounts[normalized_email] = account

        account["portfolio"] = payload.portfolio.model_dump()
        _write_store(store)

    return PortfolioState(**account["portfolio"])
