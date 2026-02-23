"""SignalR notification activity."""

import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def register_signalr_activity(app, hub_name: str, connection_setting: str):
    """Register the SignalR notification activity."""

    @app.activity_trigger(input_name="payload")
    @app.generic_output_binding(
        arg_name="signalRMessages",
        type="signalR",
        hub_name=hub_name,
        connection_string_setting=connection_setting,
    )
    def notify_user(payload: dict, signalRMessages) -> dict:
        """Send SignalR notification to a workflow group.

        Payload:
        {
            "instance_id": str,   # Workflow instance (used to build group name)
            "event": str,         # Event type (e.g. stepStarted, stepCompleted)
            "data": dict          # Event data
        }
        """
        instance_id = payload.get("instance_id", "")
        event = payload.get("event", "unknown")
        data = payload.get("data", {})

        message = {
            "groupName": f"workflow-{instance_id}",
            "target": event,
            "arguments": [{
                "event": event,
                "instanceId": instance_id,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data,
            }],
        }

        signalRMessages.set(json.dumps(message))
        logger.info(f"[{instance_id}] SignalR: {event}")

        return {"sent": True, "event": event}

    return notify_user
