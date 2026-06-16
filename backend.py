"""Compatibility wrapper for the unified FastAPI application.

Tests and older launch commands still import ``backend.app``. Re-export the
single app instance from ``main`` so every entrypoint serves the same routes.
"""

from main import app

