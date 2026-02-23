"""
Helper functions for the IDP workflow.
"""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def parse_human_approval(raw: Any) -> dict:
    """Parse human approval event data.

    Expects a dict with 'approved', 'feedback', 'reviewer', and optionally
    'field_selections' and 'accepted_values' keys.

    Args:
        raw: Approval data from external event (dict or JSON string)

    Returns:
        Dictionary with approval data

    Raises:
        ValueError: If input is not a valid dict or JSON string
    """
    if isinstance(raw, dict):
        return raw

    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            raise ValueError(f"Parsed JSON is not a dict: {type(parsed)}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid HITL approval JSON: {raw}")
            raise ValueError(f"HITL approval must be valid JSON: {e}") from e

    logger.error(f"Invalid HITL approval type: {type(raw)}")
    raise ValueError(f"HITL approval must be dict or JSON string, got {type(raw)}")
