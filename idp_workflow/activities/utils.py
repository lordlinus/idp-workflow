"""Common utilities for activity functions."""

import logging
import time

logger = logging.getLogger(__name__)


class ActivityContext:
    """Handles common activity boilerplate: request_id extraction, timing, logging, errors.

    Usage::

        ctx = ActivityContext(request_dict, "PDF extraction")
        try:
            ctx.log_start("from file.pdf")
            # ... do work ...
            ctx.log_complete(f"3 pages in {ctx.elapsed_ms}ms")
            return {"result": data, "step_output": output}
        except Exception:
            ctx.log_error()
            raise
    """

    def __init__(self, request_dict: dict, step_label: str):
        self.request_id: str = request_dict.get("request_id") or "unknown"
        self.step_label = step_label
        self.start_time = time.time()

    @property
    def elapsed_ms(self) -> int:
        """Milliseconds elapsed since context creation."""
        return round((time.time() - self.start_time) * 1000)

    def log(self, message: str, level: str = "info") -> None:
        getattr(logger, level)(f"[{self.request_id}] {message}")

    def log_start(self, detail: str = "") -> None:
        msg = f"Starting {self.step_label}"
        if detail:
            msg += f": {detail}"
        self.log(msg)

    def log_complete(self, detail: str = "") -> None:
        msg = f"{self.step_label} complete"
        if detail:
            msg += f": {detail}"
        self.log(msg)

    def log_error(self, error: BaseException | None = None) -> None:
        """Log the current exception. Call from an except block."""
        import sys

        exc = error or sys.exc_info()[1]
        self.log(f"{self.step_label} failed: {exc}", level="error")
