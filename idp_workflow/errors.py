"""Typed error hierarchy for IDP workflow steps."""


class IDPError(Exception):
    """Base exception for all IDP workflow errors."""

    def __init__(
        self,
        message: str,
        request_id: str | None = None,
        step_name: str | None = None,
    ):
        self.request_id = request_id
        self.step_name = step_name
        prefix = f"[{request_id}] " if request_id else ""
        step = f"{step_name}: " if step_name else ""
        super().__init__(f"{prefix}{step}{message}")


class ExtractionError(IDPError):
    """Error during document extraction (Steps 1, 3)."""

    pass


class ClassificationError(IDPError):
    """Error during document classification (Step 2)."""

    pass


class ComparisonError(IDPError):
    """Error during extraction comparison (Step 4)."""

    pass


class ReasoningError(IDPError):
    """Error during AI reasoning (Step 6)."""

    pass


class ConfigurationError(IDPError):
    """Error in workflow configuration (missing env vars, invalid domain config)."""

    pass
