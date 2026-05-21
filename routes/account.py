import json
import secrets
import sqlite3
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import BASE_DIR, DB_PATH

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
    entryPrice: float | None = None
    exitPrice: float | None = None
    realizedPnl: float | None = None
    returnPct: float | None = None
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


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_dumps(value: object) -> str:
    return json.dumps(value, separators=(",", ":"))


def _safe_portfolio(raw_value: str | None) -> dict:
    if not raw_value:
        return _default_portfolio()
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return _default_portfolio()
    if not isinstance(parsed, dict):
        return _default_portfolio()
    parsed.setdefault("startingCash", 100000)
    parsed.setdefault("cash", 100000)
    parsed.setdefault("holdings", [])
    if not isinstance(parsed["holdings"], list):
        parsed["holdings"] = []
    return parsed


def _create_account_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS accounts (
            email TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
            session_token TEXT NOT NULL,
            portfolio_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS account_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            side TEXT NOT NULL CHECK (side IN ('buy', 'sell', 'manual')),
            symbol TEXT NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            total REAL NOT NULL,
            entry_price REAL,
            exit_price REAL,
            realized_pnl REAL,
            return_pct REAL,
            note TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_account_history_email_id
            ON account_history(email, id);

        CREATE TABLE IF NOT EXISTS account_deletion_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            feedback TEXT NOT NULL,
            deleted_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )

    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(account_history)").fetchall()
    }
    column_definitions = {
        "entry_price": "REAL",
        "exit_price": "REAL",
        "realized_pnl": "REAL",
        "return_pct": "REAL",
    }
    for column_name, column_type in column_definitions.items():
        if column_name not in columns:
            conn.execute(f"ALTER TABLE account_history ADD COLUMN {column_name} {column_type}")


def _read_json_store() -> dict:
    if not STORE_PATH.exists():
        return {"accounts": {}}
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"accounts": {}}


def _migrate_json_store(conn: sqlite3.Connection) -> None:
    existing_count = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
    if existing_count:
        return

    store = _read_json_store()
    accounts = store.get("accounts", {})
    if not isinstance(accounts, dict):
        return

    now = _utc_now()
    for key, account in accounts.items():
        if not isinstance(account, dict):
            continue
        email = _normalize_email(str(account.get("email") or key))
        if not email:
            continue
        portfolio = account.get("portfolio") if isinstance(account.get("portfolio"), dict) else _default_portfolio()
        conn.execute(
            """
            INSERT OR IGNORE INTO accounts
                (email, password, role, session_token, portfolio_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                email,
                str(account.get("password") or DEFAULT_PASSWORD),
                account.get("role") if account.get("role") in {"admin", "user"} else _default_role(email),
                str(account.get("session_token") or secrets.token_urlsafe(24)),
                _json_dumps(portfolio),
                now,
                now,
            ),
        )
        for entry in account.get("history", []) if isinstance(account.get("history"), list) else []:
            if not isinstance(entry, dict):
                continue
            conn.execute(
                """
                INSERT INTO account_history
                    (email, timestamp, side, symbol, quantity, price, total, entry_price, exit_price, realized_pnl, return_pct, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    email,
                    str(entry.get("timestamp") or now),
                    entry.get("side") if entry.get("side") in {"buy", "sell", "manual"} else "manual",
                    str(entry.get("symbol") or "UNKNOWN"),
                    float(entry.get("quantity") or 0),
                    float(entry.get("price") or 0),
                    float(entry.get("total") or 0),
                    entry.get("entryPrice"),
                    entry.get("exitPrice"),
                    entry.get("realizedPnl"),
                    entry.get("returnPct"),
                    entry.get("note"),
                ),
            )

    for entry in store.get("account_deletion_feedback", []) if isinstance(store.get("account_deletion_feedback"), list) else []:
        if not isinstance(entry, dict) or not str(entry.get("feedback") or "").strip():
            continue
        conn.execute(
            """
            INSERT INTO account_deletion_feedback
                (email, role, feedback, deleted_by, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                _normalize_email(str(entry.get("email") or "unknown")),
                str(entry.get("role") or "user"),
                str(entry.get("feedback")).strip(),
                _normalize_email(str(entry.get("deleted_by") or entry.get("email") or "unknown")),
                now,
            ),
        )


def _ensure_account_tables() -> None:
    with _connect() as conn:
        _create_account_tables(conn)
        _migrate_json_store(conn)
        conn.commit()


def _history_for_email(conn: sqlite3.Connection, email: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            timestamp,
            side,
            symbol,
            quantity,
            price,
            total,
            entry_price AS entryPrice,
            exit_price AS exitPrice,
            realized_pnl AS realizedPnl,
            return_pct AS returnPct,
            note
        FROM account_history
        WHERE email = ?
        ORDER BY id
        """,
        (email,),
    ).fetchall()
    return [dict(row) for row in rows]


def _row_to_account(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    return {
        "email": row["email"],
        "password": row["password"],
        "role": row["role"],
        "portfolio": _safe_portfolio(row["portfolio_json"]),
        "history": _history_for_email(conn, row["email"]),
        "session_token": row["session_token"],
    }


def _get_account(conn: sqlite3.Connection, email: str) -> dict | None:
    row = conn.execute(
        "SELECT email, password, role, session_token, portfolio_json FROM accounts WHERE email = ?",
        (_normalize_email(email),),
    ).fetchone()
    if row is None:
        return None
    return _row_to_account(conn, row)


def _insert_account(conn: sqlite3.Connection, account: dict) -> None:
    now = _utc_now()
    conn.execute(
        """
        INSERT INTO accounts
            (email, password, role, session_token, portfolio_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            account["email"],
            account["password"],
            account["role"],
            account["session_token"],
            _json_dumps(account["portfolio"]),
            now,
            now,
        ),
    )


def _update_account(conn: sqlite3.Connection, account: dict, old_email: str | None = None) -> None:
    previous_email = _normalize_email(old_email or account["email"])
    current_email = _normalize_email(account["email"])
    now = _utc_now()
    if previous_email != current_email:
        conn.execute(
            """
            UPDATE accounts
            SET email = ?, password = ?, role = ?, session_token = ?, portfolio_json = ?, updated_at = ?
            WHERE email = ?
            """,
            (
                current_email,
                account["password"],
                account["role"],
                account["session_token"],
                _json_dumps(account["portfolio"]),
                now,
                previous_email,
            ),
        )
        conn.execute("UPDATE account_history SET email = ? WHERE email = ?", (current_email, previous_email))
    else:
        conn.execute(
            """
            UPDATE accounts
            SET password = ?, role = ?, session_token = ?, portfolio_json = ?, updated_at = ?
            WHERE email = ?
            """,
            (
                account["password"],
                account["role"],
                account["session_token"],
                _json_dumps(account["portfolio"]),
                now,
                current_email,
            ),
        )


def _delete_account(conn: sqlite3.Connection, email: str) -> None:
    normalized_email = _normalize_email(email)
    conn.execute("DELETE FROM account_history WHERE email = ?", (normalized_email,))
    conn.execute("DELETE FROM accounts WHERE email = ?", (normalized_email,))


def _append_history(conn: sqlite3.Connection, email: str, entry: dict) -> None:
    conn.execute(
        """
        INSERT INTO account_history
            (email, timestamp, side, symbol, quantity, price, total, entry_price, exit_price, realized_pnl, return_pct, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            _normalize_email(email),
            entry["timestamp"],
            entry["side"],
            entry["symbol"],
            float(entry["quantity"]),
            float(entry["price"]),
            float(entry["total"]),
            entry.get("entryPrice"),
            entry.get("exitPrice"),
            entry.get("realizedPnl"),
            entry.get("returnPct"),
            entry.get("note"),
        ),
    )


def _record_deletion_feedback(conn: sqlite3.Connection, *, email: str, role: str, feedback: str | None, deleted_by: str) -> None:
    if not feedback or not feedback.strip():
        return
    conn.execute(
        """
        INSERT INTO account_deletion_feedback
            (email, role, feedback, deleted_by, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (_normalize_email(email), role, feedback.strip(), _normalize_email(deleted_by), _utc_now()),
    )


def _account_to_admin_view(account: dict) -> AdminAccountView:
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
    return SessionData(
        email=account["email"],
        role=account["role"],
        sessionToken=account["session_token"],
    )


def _require_session(account: dict, session_token: str | None) -> None:
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
        _ensure_account_tables()
        with _connect() as conn:
            account = _get_account(conn, normalized_email)
            return deepcopy(account) if account else None


def _ensure_account(email: str, password: str | None = None) -> dict:
    normalized_email = _normalize_email(email)
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            account = _get_account(conn, normalized_email)
            if account is None:
                account = {
                    "email": normalized_email,
                    "password": password or DEFAULT_PASSWORD,
                    "role": _default_role(normalized_email),
                    "portfolio": _default_portfolio(),
                    "history": _default_history(),
                    "session_token": secrets.token_urlsafe(24),
                }
                _insert_account(conn, account)
                conn.commit()
            return deepcopy(account)


def _account_response(account: dict) -> AccountStateResponse:
    return AccountStateResponse(
        session=_make_session(account),
        portfolio=PortfolioState(**account["portfolio"]),
    )


@router.post("/login", response_model=AccountStateResponse)
def login(payload: AuthRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            account = _get_account(conn, normalized_email)
            if account is None:
                account = {
                    "email": normalized_email,
                    "password": payload.password.strip() or DEFAULT_PASSWORD,
                    "role": _default_role(normalized_email),
                    "portfolio": _default_portfolio(),
                    "history": _default_history(),
                    "session_token": secrets.token_urlsafe(24),
                }
                _insert_account(conn, account)
            if account["password"] != payload.password.strip():
                raise HTTPException(status_code=401, detail="Invalid email or password.")
            account["session_token"] = secrets.token_urlsafe(24)
            _update_account(conn, account)
            conn.commit()
            account_copy = deepcopy(account)
    return _account_response(account_copy)


@router.post("/register", response_model=AccountStateResponse)
def register(payload: AuthRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            if _get_account(conn, normalized_email) is not None:
                raise HTTPException(status_code=409, detail="Account already exists.")
            account = {
                "email": normalized_email,
                "password": payload.password.strip() or DEFAULT_PASSWORD,
                "role": _default_role(normalized_email),
                "portfolio": _default_portfolio(),
                "history": _default_history(),
                "session_token": secrets.token_urlsafe(24),
            }
            _insert_account(conn, account)
            conn.commit()
    return _account_response(account)


@router.get("/portfolio", response_model=PortfolioState)
def get_portfolio(email: str, session_token: str):
    normalized_email = _normalize_email(email)
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            account = _get_account(conn, normalized_email)
            if account is None:
                raise HTTPException(status_code=404, detail="Account not found.")
            _require_session(account, session_token)
            account_copy = deepcopy(account)
    return PortfolioState(**account_copy["portfolio"])


@router.post("/portfolio", response_model=PortfolioState)
def save_portfolio(payload: PortfolioSaveRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            account = _get_account(conn, normalized_email)
            if account is None:
                raise HTTPException(status_code=404, detail="Account not found.")

            _require_session(account, payload.sessionToken)
            account["portfolio"] = payload.portfolio.model_dump()
            if payload.history_entry is not None:
                history_entry = payload.history_entry.model_dump()
                account.setdefault("history", []).append(history_entry)
                _append_history(conn, normalized_email, history_entry)
            _update_account(conn, account)
            conn.commit()
            account_copy = deepcopy(account)

    return PortfolioState(**account_copy["portfolio"])


@router.get("/admin/users", response_model=AdminAccountsResponse)
def get_admin_users(admin_email: str, session_token: str):
    normalized_email = _normalize_email(admin_email)
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            admin_account = _get_account(conn, normalized_email)
            if admin_account is None:
                raise HTTPException(status_code=404, detail="Admin account not found.")

            _require_admin(admin_account, session_token)

            rows = conn.execute(
                "SELECT email, password, role, session_token, portfolio_json FROM accounts"
            ).fetchall()
            users = [_account_to_admin_view(_row_to_account(conn, row)) for row in rows]
            users.sort(key=lambda item: (item.role != "admin", item.email))

    return AdminAccountsResponse(users=users)


@router.patch("/profile", response_model=AccountStateResponse)
def update_profile(payload: ProfileUpdateRequest):
    normalized_email = _normalize_email(payload.email)
    next_email = _normalize_email(payload.new_email) if payload.new_email else None
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            account = _get_account(conn, normalized_email)
            if account is None:
                raise HTTPException(status_code=404, detail="Account not found.")

            _require_session(account, payload.sessionToken)

            if next_email and next_email != normalized_email:
                if _is_primary_admin(normalized_email):
                    raise HTTPException(status_code=400, detail="Primary admin email cannot be changed.")
                if _get_account(conn, next_email) is not None:
                    raise HTTPException(status_code=409, detail="That email is already in use.")
                _apply_account_updates(account, new_email=next_email, new_password=payload.new_password)
                account["session_token"] = secrets.token_urlsafe(24)
                _update_account(conn, account, old_email=normalized_email)
            else:
                _apply_account_updates(account, new_password=payload.new_password)
                account["session_token"] = secrets.token_urlsafe(24)
                _update_account(conn, account)

            conn.commit()
            account_copy = deepcopy(account)

    return _account_response(account_copy)


@router.patch("/admin/users", response_model=AdminAccountView)
def update_admin_user(payload: AdminAccountUpdateRequest):
    normalized_admin = _normalize_email(payload.admin_email)
    normalized_target = _normalize_email(payload.target_email)
    next_email = _normalize_email(payload.new_email) if payload.new_email else None
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            admin_account = _get_account(conn, normalized_admin)
            if admin_account is None:
                raise HTTPException(status_code=404, detail="Admin account not found.")

            _require_admin(admin_account, payload.sessionToken)

            target_account = _get_account(conn, normalized_target)
            if target_account is None:
                raise HTTPException(status_code=404, detail="Target account not found.")

            if _is_primary_admin(normalized_target):
                if payload.role == "user":
                    raise HTTPException(status_code=400, detail="Primary admin role cannot be changed.")
                if next_email and next_email != normalized_target:
                    raise HTTPException(status_code=400, detail="Primary admin email cannot be changed.")

            if next_email and next_email != normalized_target and _get_account(conn, next_email) is not None:
                raise HTTPException(status_code=409, detail="That email is already in use.")

            _apply_account_updates(
                target_account,
                new_email=next_email if next_email and next_email != normalized_target else None,
                new_password=payload.new_password,
                new_role=payload.role,
            )
            _update_account(conn, target_account, old_email=normalized_target)
            conn.commit()
            target_copy = deepcopy(target_account)

    return _account_to_admin_view(target_copy)


@router.delete("/profile", response_model=ActionResponse)
def delete_profile(payload: DeleteAccountRequest):
    normalized_email = _normalize_email(payload.email)
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            account = _get_account(conn, normalized_email)
            if account is None:
                raise HTTPException(status_code=404, detail="Account not found.")

            _require_session(account, payload.sessionToken)

            if _is_primary_admin(normalized_email):
                raise HTTPException(status_code=400, detail="Primary admin account cannot be deleted.")

            _record_deletion_feedback(
                conn,
                email=account["email"],
                role=account["role"],
                feedback=payload.feedback,
                deleted_by=account["email"],
            )
            _delete_account(conn, normalized_email)
            conn.commit()

    return ActionResponse(ok=True, message="Account deleted.")


@router.delete("/admin/users", response_model=ActionResponse)
def delete_admin_user(payload: AdminDeleteAccountRequest):
    normalized_admin = _normalize_email(payload.admin_email)
    normalized_target = _normalize_email(payload.target_email)
    with STORE_LOCK:
        _ensure_account_tables()
        with _connect() as conn:
            admin_account = _get_account(conn, normalized_admin)
            if admin_account is None:
                raise HTTPException(status_code=404, detail="Admin account not found.")

            _require_admin(admin_account, payload.sessionToken)

            if normalized_admin == normalized_target:
                raise HTTPException(status_code=400, detail="Use profile deletion for your own account.")

            target_account = _get_account(conn, normalized_target)
            if target_account is None:
                raise HTTPException(status_code=404, detail="Target account not found.")

            if _is_primary_admin(normalized_target):
                raise HTTPException(status_code=400, detail="Primary admin account cannot be deleted.")

            _record_deletion_feedback(
                conn,
                email=target_account["email"],
                role=target_account["role"],
                feedback=payload.feedback,
                deleted_by=admin_account["email"],
            )
            _delete_account(conn, normalized_target)
            conn.commit()

    return ActionResponse(ok=True, message="Account deleted.")


_ensure_account_tables()
