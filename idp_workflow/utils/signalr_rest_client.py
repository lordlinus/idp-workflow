"""Direct Azure SignalR REST client for sending messages from activities.

This bypasses the Durable Functions orchestrator so activities can push
real-time SignalR messages (e.g., reasoning chunks) while they are running.
"""

import hashlib
import hmac
import json
import logging
import os
import time
import base64
from datetime import datetime
from urllib.parse import quote

import requests

from idp_workflow.config import SIGNALR_HUB_NAME, SIGNALR_CONNECTION_SETTING

logger = logging.getLogger(__name__)


def _parse_connection_string(conn_str: str) -> tuple[str, str]:
    """Parse an Azure SignalR connection string into (endpoint, access_key).

    Connection string format:
        Endpoint=https://xxx.service.signalr.net;AccessKey=yyy;Version=1.0;
    """
    parts: dict[str, str] = {}
    for segment in conn_str.split(";"):
        segment = segment.strip()
        if "=" in segment:
            key, _, value = segment.partition("=")
            # AccessKey values contain '=' padding, so rejoin
            if key in parts:
                parts[key] += "=" + value
            else:
                parts[key] = value

    endpoint = parts.get("Endpoint", "").rstrip("/")
    access_key = parts.get("AccessKey", "")

    if not endpoint or not access_key:
        raise ValueError(
            "Invalid SignalR connection string — missing Endpoint or AccessKey"
        )

    return endpoint, access_key


def _generate_jwt(endpoint: str, access_key: str, audience: str, ttl: int = 3600) -> str:
    """Generate a JWT token for Azure SignalR REST API authentication.

    Uses HMAC-SHA256 with the SignalR access key (no external JWT library needed).
    """
    now = int(time.time())

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "aud": audience,
        "iat": now,
        "exp": now + ttl,
    }

    def _b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode())

    signing_input = f"{header_b64}.{payload_b64}"
    # Azure SignalR expects the AccessKey used directly as UTF-8 bytes
    # (NOT base64-decoded) for HMAC-SHA256 signing.
    key_bytes = access_key.encode("utf-8")
    signature = hmac.new(key_bytes, signing_input.encode(), hashlib.sha256).digest()
    signature_b64 = _b64url(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


class SignalRRestClient:
    """Send messages directly to Azure SignalR Service via REST API.

    This is used inside Durable Functions *activities* to push intermediate
    updates (e.g., reasoning stream chunks) while the orchestrator is
    suspended waiting for the activity to finish.
    """

    def __init__(
        self,
        hub_name: str | None = None,
        connection_string: str | None = None,
    ):
        conn_str = connection_string or os.getenv(SIGNALR_CONNECTION_SETTING, "")
        if not conn_str:
            raise ValueError(
                f"No SignalR connection string found in env var '{SIGNALR_CONNECTION_SETTING}'"
            )

        self.hub_name = hub_name or SIGNALR_HUB_NAME
        self.endpoint, self._access_key = _parse_connection_string(conn_str)
        self._session = requests.Session()
        self._session.headers["Content-Type"] = "application/json"

        logger.info(
            f"SignalRRestClient initialised — endpoint={self.endpoint}, hub={self.hub_name}"
        )

    def _get_auth_header(self, audience: str) -> str:
        token = _generate_jwt(self.endpoint, self._access_key, audience)
        return f"Bearer {token}"

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def send_to_user(
        self,
        user_id: str,
        target: str,
        arguments: list,
    ) -> None:
        """Send a SignalR message to a specific user.

        Mirrors the output-binding format used by notify_user:
          target  = event name (e.g. "reasoningChunk")
          arguments = [{ event, instanceId, timestamp, data }]
        """
        url = (
            f"{self.endpoint}/api/v1/hubs/{quote(self.hub_name)}"
            f"/users/{quote(user_id)}"
        )
        # Per Azure docs the JWT audience MUST equal the full HTTP request URL
        # (without trailing slash or query parameters).
        audience = url

        body = {"target": target, "arguments": arguments}

        try:
            resp = self._session.post(
                url,
                json=body,
                headers={"Authorization": self._get_auth_header(audience)},
                timeout=5,
            )
            resp.raise_for_status()
            logger.debug(f"SignalR REST → {target} to user {user_id} (HTTP {resp.status_code})")
        except requests.RequestException as exc:
            # Non-fatal: log and continue — the workflow should not fail
            # because a UI notification could not be delivered.
            logger.warning(
                f"SignalR REST send failed ({target} → {user_id}): {exc}"
            )

    def send_reasoning_chunk(
        self,
        user_id: str,
        instance_id: str,
        chunk_type: str,
        content: str,
        chunk_index: int,
        metadata: dict | None = None,
    ) -> None:
        """Convenience wrapper for sending a reasoningChunk event."""
        self.send_to_user(
            user_id=user_id,
            target="reasoningChunk",
            arguments=[
                {
                    "event": "reasoningChunk",
                    "instanceId": instance_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": {
                        "chunkType": chunk_type,
                        "content": content,
                        "chunkIndex": chunk_index,
                        "metadata": metadata or {},
                    },
                }
            ],
        )

    def send_step_progress(
        self,
        user_id: str,
        instance_id: str,
        step_name: str,
        message: str,
        progress: int | None = None,
        detail: str | None = None,
        sub_step: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        """Send an intermediate step progress update.

        Used by activities for steps 1-4 to push live progress while
        the orchestrator is suspended.
        """
        data: dict = {
            "stepName": step_name,
            "message": message,
        }
        if progress is not None:
            data["progress"] = progress
        if detail:
            data["detail"] = detail
        if sub_step:
            data["subStep"] = sub_step
        if metadata:
            data["metadata"] = metadata

        self.send_to_user(
            user_id=user_id,
            target="stepProgress",
            arguments=[
                {
                    "event": "stepProgress",
                    "instanceId": instance_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": data,
                }
            ],
        )
