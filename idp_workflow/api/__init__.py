"""API endpoints for the IDP workflow."""

from .endpoints import (
    register_http_endpoints,
    register_signalr_endpoints,
)

__all__ = [
    "register_http_endpoints",
    "register_signalr_endpoints",
]
