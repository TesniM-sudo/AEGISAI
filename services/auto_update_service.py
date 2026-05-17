"""Background database updater for AegisAI.

Runs the existing `update_all.py` pipeline on an interval while the FastAPI app
is running, so the frontend can always read fresh `/dashboard/*` data without
manual script runs.
"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional


_run_mutex = threading.Lock()
_state_lock = threading.Lock()
_stop_event = threading.Event()
_thread: Optional[threading.Thread] = None

_state: Dict[str, Any] = {
    "enabled": False,
    "interval_minutes": None,
    "run_on_start": None,
    "running": False,
    "last_started_at": None,
    "last_finished_at": None,
    "last_success_at": None,
    "last_error": None,
    "last_result": None,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_status() -> Dict[str, Any]:
    with _state_lock:
        return dict(_state)


def run_update_once() -> Dict[str, Any]:
    """Run one update pass (non-concurrent).

    Returns a status dict; if an update is already running, returns immediately.
    """
    acquired = _run_mutex.acquire(blocking=False)
    if not acquired:
        with _state_lock:
            return {
                **dict(_state),
                "message": "Update already running",
            }

    with _state_lock:
        _state["running"] = True
        _state["last_started_at"] = _utc_now_iso()
        _state["last_error"] = None

    try:
        from update_all import run_update_all

        result = run_update_all()
        with _state_lock:
            _state["last_result"] = result
            _state["last_success_at"] = _utc_now_iso()
        return {"ok": True, "result": result}
    except Exception as exc:  # noqa: BLE001 - we want to capture any failure
        with _state_lock:
            _state["last_error"] = f"{type(exc).__name__}: {exc}"
            _state["last_result"] = None
        return {"ok": False, "error": str(exc)}
    finally:
        with _state_lock:
            _state["last_finished_at"] = _utc_now_iso()
            _state["running"] = False
        _run_mutex.release()


def trigger_update_background() -> Dict[str, Any]:
    """Start an update in a daemon thread (if not already running)."""
    if _run_mutex.locked():
        return {"started": False, "message": "Update already running"}

    def _worker() -> None:
        run_update_once()

    threading.Thread(target=_worker, name="aegis-update-once", daemon=True).start()
    return {"started": True}


def _loop(interval_seconds: int, run_on_start: bool) -> None:
    if run_on_start:
        run_update_once()

    while not _stop_event.wait(interval_seconds):
        run_update_once()


def start() -> Dict[str, Any]:
    """Start the background updater if enabled via env vars."""
    enabled_raw = os.getenv("AEGISAI_AUTO_UPDATE", "1").strip().lower()
    enabled = enabled_raw not in {"0", "false", "no", "off"}

    interval_minutes = int(os.getenv("AEGISAI_AUTO_UPDATE_INTERVAL_MIN", "240") or "240")
    interval_minutes = max(5, interval_minutes)  # avoid accidental tight loops
    run_on_start_raw = os.getenv("AEGISAI_AUTO_UPDATE_RUN_ON_START", "1").strip().lower()
    run_on_start = run_on_start_raw not in {"0", "false", "no", "off"}

    with _state_lock:
        _state["enabled"] = enabled
        _state["interval_minutes"] = interval_minutes
        _state["run_on_start"] = run_on_start

    if not enabled:
        return {"started": False, "enabled": False}

    global _thread
    if _thread and _thread.is_alive():
        return {"started": False, "message": "Already running"}

    _stop_event.clear()
    _thread = threading.Thread(
        target=_loop,
        args=(interval_minutes * 60, run_on_start),
        name="aegis-auto-updater",
        daemon=True,
    )
    _thread.start()
    return {"started": True, "enabled": True, "interval_minutes": interval_minutes, "run_on_start": run_on_start}


def stop(timeout_seconds: float = 2.0) -> None:
    global _thread
    _stop_event.set()
    if _thread and _thread.is_alive():
        _thread.join(timeout=timeout_seconds)
    _thread = None

