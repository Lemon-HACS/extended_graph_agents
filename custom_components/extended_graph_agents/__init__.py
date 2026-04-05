"""Extended Graph Agents integration."""
from __future__ import annotations
import logging
import uuid
from pathlib import Path
from typing import Any
from openai import AsyncClient
import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.helpers import config_validation as cv
import json
from .const import (
    CONF_API_KEY, CONF_BASE_URL, DEFAULT_BASE_URL, DEFAULT_CHAT_MODEL,
    DOMAIN, EVENT_GRAPH_EXECUTION_FINISHED, GRAPHS_SUBDIR,
)
from .websocket_api import async_setup_websocket_api
from .websocket_api_v2 import async_setup_websocket_api_v2

_LOGGER = logging.getLogger(__name__)
PLATFORMS = [Platform.CONVERSATION]

type ExtendedGraphAgentsConfigEntry = ConfigEntry[AsyncClient]


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    return True


async def async_setup_entry(
    hass: HomeAssistant, entry: ExtendedGraphAgentsConfigEntry
) -> bool:
    """Set up Extended Graph Agents."""
    client = AsyncClient(
        api_key=entry.data[CONF_API_KEY],
        base_url=entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL),
    )
    entry.runtime_data = client

    # Register WebSocket API
    async_setup_websocket_api(hass)
    async_setup_websocket_api_v2(hass)

    # Register static files
    www_dir = Path(__file__).parent / "www"
    if www_dir.exists():
        await hass.http.async_register_static_paths(
            [StaticPathConfig(f"/{DOMAIN}_static", str(www_dir), cache_headers=False)]
        )

    # Read version for cache busting (executor to avoid blocking event loop)
    manifest_path = Path(__file__).parent / "manifest.json"
    version = await hass.async_add_executor_job(
        lambda: json.loads(manifest_path.read_text())["version"]
    )

    # Register frontend panel
    try:
        async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title="Graph Agents",
            sidebar_icon="mdi:graph",
            frontend_url_path=DOMAIN,
            config={
                "_panel_custom": {
                    "name": "extended-graph-agents-panel",
                    "js_url": f"/{DOMAIN}_static/panel.js?v={version}",
                    "embed_iframe": False,
                    "trust_external": False,
                }
            },
            require_admin=True,
        )
    except Exception as err:
        _LOGGER.warning("Could not register panel: %s", err)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register run_graph service
    async def handle_run_graph(call: ServiceCall) -> None:
        from .graph_engine import GraphEngine, ExecutionEvent
        from .graph_state import GraphState
        from .graph_loader import GraphLoader
        from .helpers import get_exposed_entities
        from .exceptions import GraphNotFound, GraphExecutionError

        graph_id: str = call.data["graph_id"]
        user_input: str = call.data.get("input", "")

        graphs_dir = Path(hass.config.config_dir) / GRAPHS_SUBDIR
        loader = GraphLoader(str(graphs_dir))

        try:
            graph = loader.load_by_id(graph_id)
        except GraphNotFound:
            _LOGGER.error("run_graph: graph '%s' not found", graph_id)
            return

        state = GraphState(
            user_input=user_input,
            conversation_id=str(uuid.uuid4()),
            language="en",
        )

        trace: list[dict] = []

        def on_event(event: ExecutionEvent) -> None:
            trace.append({"type": event.event_type, **event.data})

        try:
            engine = GraphEngine(
                hass=hass,
                client=entry.runtime_data,
                default_model=graph.model or DEFAULT_CHAT_MODEL,
                event_callback=on_event,
            )
            output = await engine.execute(graph, state, get_exposed_entities(hass))
        except (GraphExecutionError, Exception) as err:
            _LOGGER.error("run_graph: execution failed for '%s': %s", graph_id, err)
            hass.bus.async_fire(
                EVENT_GRAPH_EXECUTION_FINISHED,
                {"graph_id": graph_id, "user_input": user_input, "output": None, "error": str(err), "trace": trace},
            )
            return

        hass.bus.async_fire(
            EVENT_GRAPH_EXECUTION_FINISHED,
            {"graph_id": graph_id, "user_input": user_input, "output": output, "error": None, "trace": trace},
        )

    hass.services.async_register(
        DOMAIN,
        "run_graph",
        handle_run_graph,
        schema=vol.Schema({
            vol.Required("graph_id"): cv.string,
            vol.Optional("input", default=""): cv.string,
        }),
    )

    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: ExtendedGraphAgentsConfigEntry
) -> bool:
    """Unload config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
