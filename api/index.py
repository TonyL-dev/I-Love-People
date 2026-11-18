"""Vercel's function entrypoint; the installed package contains application code."""

from ilp.main import app

__all__ = ["app"]
