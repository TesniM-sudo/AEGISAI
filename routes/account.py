import json
import secrets
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
    sessionToken: str


class Holding(BaseModel):
    symbol: str
    name: str
    quantity: float
    avgPrice: float


class PortfolioState(BaseModel):
    startingCash: float = 100000
    cash: float = 100000
    holdings: list[Holding] = Field(default_factory=list)


class HistoryEntry(BaseModel):
    timestamp: str
    side: Literal["buy", "sell", "manual"]
    symbol: str
    quantity: float
    price: float
    total: float
    note: str | None = None


class AccountStateResponse(BaseModel):
    session: SessionData
    portfolio: PortfolioState


class AuthRequest(BaseModel):
    email: str
    password: str


class PortfolioSaveRequest(BaseModel):
    email: str
    sessionToken: str | None = None
    portfolio: PortfolioState
    history_entry: HistoryEntry | None = None


class AdminAccountView(BaseModel):
    email: str
    password: str
    role: Literal["admin", "user"]
    portfolio: PortfolioState
    history: list[HistoryEntry] = Field(default_factory=list)


class AdminAccountsResponse(BaseModel):
    users: list[AdminAccountView]


class ProfileUpdateRequest(BaseModel):
    email: str
    sessionToken: str
    new_email: str | None = None
    new_password: str | None = None


class AdminAccountUpdateRequest(BaseModel):
    admin_email: str
    sessionToken: str
    target_email: str
    new_email: str | None = None
    new_password: str | None = None
    role: Literal["admin", "user"] | None = None


class DeleteAccountRequest(BaseModel):
    email: str
    sessionToken: str
    feedback: str | None = None


class AdminDeleteAccountRequest(BaseModel):
    admin_email: str
    sessionToken: str
    target_email: str
    feedback: str | None = None


class ActionResponse(BaseModel):
    ok: bool
    message: str


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


def _default_history() -> list[dict]:
    return []


def _is_primary_admin(email: str) -> bool:
    return _normalize_email(email) == "admin@aegisai.com"


def _read_store() -> dict:
    if not STORE_PATH.exists():
        return {"accounts": {}}
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"accounts": {}}


def _write_store(store: dict) -> None:
    STORE_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def _ensure_account_shape(account: dict) -> dict:
    account.setdefault("portfolio", _default_portfolio())
    account.setdefault("history", _default_history())
    account.setdefault("session_token", secrets.token_urlsafe(24))
    return account


def _record_deletion_feedback(store: dict, *, email: str, role: str, feedback: str | None, deleted_by: str) -> None:
    if not feedback or not feedback.strip():
        return
    entries = store.setdefault("account_deletion_feedback", [])
    entries.append(
        {
            "email": email,
            "role": role,
            "feedback": feedback.strip(),
            "deleted_by": deleted_by,
        }
    )


def _account_to_admin_view(account: dict) -> AdminAccountView:
    _ensure_account_shape(account)
    return AdminAccountView(
        email=account["email"],
        password=account["password"],
        role=account["role"],
        portfolio=PortfolioState(**account["portfolio"]),
        history=[HistoryEntry(**entry) for entry in account.get("history", [])],
    )


def _apply_account_updates(
    account: dict,
    *,
    new_email: str | None = None,
    new_password: str | None = None,
    new_role: Literal["admin", "user"] | None = None,
) -> None:
    if new_email is not None:
        account["email"] = _normalize_email(new_email)
    if new_password is not None:
        cleaned_password = new_password.strip()
        if not cleaned_password:
            raise HTTPException(status_code=400, detail="Password cannot be empty.")
        account["password"] = cleaned_password
    if new_role is not None:
        account["role"] = new_role


def _make_session(account: dict) -> SessionData:
    _ensure_account_shape(account)
    return SessionData(
        email=account["email"],
        role=account["role"],
        sessionToken=account["session_token"],
    )


def _require_session(account: dict, session_token: str | None) -> None:
    _ensure_account_shape(account)
    if not session_token or account["session_token"] != session_token:
        raise HTTPException(status_code=403, detail="Invalid session token.")


def _require_admin(account: dict, session_token: str | None) -> None:
    _require_session(account, session_token)
    if account["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")


def get_account_record(email: str) -> dict | None:
    """Return a stored account snapshot without creating a new one."""
    normalized_email = _normalize_email(email)
    with STORE_LOCK:
        store = _read_store()
        account = store.get("accounts", {}).get(normalized_email)
        if not account:
            return None
        _ensure_account_shape(account)
        return deepcopy(account)


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
                "history": _default_history(),
                "session_token": secrets.token_urlsafe(24),
            }
            accounts[normalized_email] = account
            _write_store(store)
        else:
            _ensure_account_shape(account)
            _write_store(store)
        return deepcopy(account)


def _account_response(account: dict) -> AccountStateResponse:
    _ensure_account_shape(account)
    return AccountStateResponse(
        session=_make_session(account),
        portfolio=PortfolioState(**account["portfolio"]),
    )


@router.post("/login", response_model=AccountStateResponse)
def login(payload: AuthRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        account = accounts.get(normalized_email)
        if account is None:
            account = {
                "email": normalized_email,
                "password": payload.password.strip() or DEFAULT_PASSWORD,
                "role": _default_role(normalized_email),
                "portfolio": _default_portfolio(),
                "history": _default_history(),
                "session_token": secrets.token_urlsafe(24),
            }
            accounts[normalized_email] = account
        _ensure_account_shape(account)
        if account["password"] != payload.password.strip():
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        account["session_token"] = secrets.token_urlsafe(24)
        _write_store(store)
        account_copy = deepcopy(account)
    return _account_response(account_copy)


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
            "history": _default_history(),
            "session_token": secrets.token_urlsafe(24),
        }
        accounts[normalized_email] = account
        _write_store(store)
    return _account_response(account)


@router.get("/portfolio", response_model=PortfolioState)
def get_portfolio(email: str, session_token: str):
    normalized_email = _normalize_email(email)
    with STORE_LOCK:
        store = _read_store()
        account = store.get("accounts", {}).get(normalized_email)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found.")
        _require_session(account, session_token)
        account_copy = deepcopy(account)
    return PortfolioState(**account_copy["portfolio"])


@router.post("/portfolio", response_model=PortfolioState)
def save_portfolio(payload: PortfolioSaveRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        account = accounts.get(normalized_email)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found.")

        _require_session(account, payload.sessionToken)
        account["portfolio"] = payload.portfolio.model_dump()
        if payload.history_entry is not None:
            history = account.setdefault("history", [])
            history.append(payload.history_entry.model_dump())
        _write_store(store)
        account_copy = deepcopy(account)

    return PortfolioState(**account_copy["portfolio"])


@router.get("/admin/users", response_model=AdminAccountsResponse)
def get_admin_users(admin_email: str, session_token: str):
    normalized_email = _normalize_email(admin_email)
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        admin_account = accounts.get(normalized_email)
        if admin_account is None:
            raise HTTPException(status_code=404, detail="Admin account not found.")

        _require_admin(admin_account, session_token)

        users = []
        for account in accounts.values():
            users.append(_account_to_admin_view(account))

        users.sort(key=lambda item: (item.role != "admin", item.email))
        _write_store(store)

    return AdminAccountsResponse(users=users)


@router.patch("/profile", response_model=AccountStateResponse)
def update_profile(payload: ProfileUpdateRequest):
    normalized_email = _normalize_email(payload.email)
    next_email = _normalize_email(payload.new_email) if payload.new_email else None
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        account = accounts.get(normalized_email)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found.")

        _require_session(account, payload.sessionToken)

        if next_email and next_email != normalized_email:
            if _is_primary_admin(normalized_email):
                raise HTTPException(status_code=400, detail="Primary admin email cannot be changed.")
            if next_email in accounts:
                raise HTTPException(status_code=409, detail="That email is already in use.")
            del accounts[normalized_email]
            _apply_account_updates(account, new_email=next_email, new_password=payload.new_password)
            account["session_token"] = secrets.token_urlsafe(24)
            accounts[next_email] = account
        else:
            _apply_account_updates(account, new_password=payload.new_password)
            account["session_token"] = secrets.token_urlsafe(24)

        _write_store(store)
        account_copy = deepcopy(account)

    return _account_response(account_copy)


@router.patch("/admin/users", response_model=AdminAccountView)
def update_admin_user(payload: AdminAccountUpdateRequest):
    normalized_admin = _normalize_email(payload.admin_email)
    normalized_target = _normalize_email(payload.target_email)
    next_email = _normalize_email(payload.new_email) if payload.new_email else None
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        admin_account = accounts.get(normalized_admin)
        if admin_account is None:
            raise HTTPException(status_code=404, detail="Admin account not found.")

        _require_admin(admin_account, payload.sessionToken)

        target_account = accounts.get(normalized_target)
        if target_account is None:
            raise HTTPException(status_code=404, detail="Target account not found.")

        if _is_primary_admin(normalized_target):
            if payload.role == "user":
                raise HTTPException(status_code=400, detail="Primary admin role cannot be changed.")
            if next_email and next_email != normalized_target:
                raise HTTPException(status_code=400, detail="Primary admin email cannot be changed.")

        if next_email and next_email != normalized_target and next_email in accounts:
            raise HTTPException(status_code=409, detail="That email is already in use.")

        if next_email and next_email != normalized_target:
            del accounts[normalized_target]
            _apply_account_updates(
                target_account,
                new_email=next_email,
                new_password=payload.new_password,
                new_role=payload.role,
            )
            accounts[next_email] = target_account
        else:
            _apply_account_updates(target_account, new_password=payload.new_password, new_role=payload.role)

        _write_store(store)
        target_copy = deepcopy(target_account)

    return _account_to_admin_view(target_copy)


@router.delete("/profile", response_model=ActionResponse)
def delete_profile(payload: DeleteAccountRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        account = accounts.get(normalized_email)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found.")

        _require_session(account, payload.sessionToken)

        if _is_primary_admin(normalized_email):
            raise HTTPException(status_code=400, detail="Primary admin account cannot be deleted.")

        _record_deletion_feedback(
            store,
            email=account["email"],
            role=account["role"],
            feedback=payload.feedback,
            deleted_by=account["email"],
        )
        del accounts[normalized_email]
        _write_store(store)

    return ActionResponse(ok=True, message="Account deleted.")


@router.delete("/admin/users", response_model=ActionResponse)
def delete_admin_user(payload: AdminDeleteAccountRequest):
    normalized_admin = _normalize_email(payload.admin_email)
    normalized_target = _normalize_email(payload.target_email)
    with STORE_LOCK:
        store = _read_store()
        accounts = store.setdefault("accounts", {})
        admin_account = accounts.get(normalized_admin)
        if admin_account is None:
            raise HTTPException(status_code=404, detail="Admin account not found.")

        _require_admin(admin_account, payload.sessionToken)

        if normalized_admin == normalized_target:
            raise HTTPException(status_code=400, detail="Use profile deletion for your own account.")

        target_account = accounts.get(normalized_target)
        if target_account is None:
            raise HTTPException(status_code=404, detail="Target account not found.")

        if _is_primary_admin(normalized_target):
            raise HTTPException(status_code=400, detail="Primary admin account cannot be deleted.")

        _record_deletion_feedback(
            store,
            email=target_account["email"],
            role=target_account["role"],
            feedback=payload.feedback,
            deleted_by=admin_account["email"],
        )
        del accounts[normalized_target]
        _write_store(store)

    return ActionResponse(ok=True, message="Account deleted.")
