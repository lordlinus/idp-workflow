"""IDP Workflow – Azure Durable Functions entry point.

Registers orchestration, activities, HTTP + SignalR endpoints.
"""

import logging

import azure.functions as func
import azure.durable_functions as df

from idp_workflow.config import SIGNALR_HUB_NAME, SIGNALR_CONNECTION_SETTING
from idp_workflow.activities import register_activities
from idp_workflow.activities.signalr import register_signalr_activity
from idp_workflow.orchestration import register_orchestration
from idp_workflow.api import register_http_endpoints, register_signalr_endpoints

logger = logging.getLogger(__name__)

# ── App ──────────────────────────────────────────────────────────────────────

app = df.DFApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# ── Register components ─────────────────────────────────────────────────────

register_activities(app)
register_orchestration(app)
register_http_endpoints(app)
register_signalr_endpoints(app)
register_signalr_activity(app, SIGNALR_HUB_NAME, SIGNALR_CONNECTION_SETTING)

logger.info("IDP Workflow app initialized")
