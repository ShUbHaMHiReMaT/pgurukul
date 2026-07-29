"""Middleware package."""
from .security_headers import apply_security_headers

__all__ = ["apply_security_headers"]
