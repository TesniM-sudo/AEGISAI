"""Compatibility wrapper for the unified FastAPI application.

Some environments still start the server with ``app:app``. Re-export the
single app instance from ``main`` so frontend routes stay in sync.
"""

from main import app
