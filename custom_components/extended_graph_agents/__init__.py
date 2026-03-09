"""Extended Graph Agents integration."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Any
from openai import AsyncClient
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
import json
from .const import CONF_API_KEY, CONF_BASE_URL, DEFAULT_BASE_URL, DOMAIN
from .websocket_api import async_setup_websocket_api

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

    # Register static files
    www_dir = Path(__file__).parent / "www"
    if www_dir.exists():
        await hass.http.async_register_static_paths(
            [StaticPathConfig(f"/{DOMAIN}_static", str(www_dir), cache_headers=False)]
        )

    # Read version for cache busting
    manifest_path = Path(__file__).parent / "manifest.json"
    version = json.loads(manifest_path.read_text())["version"]

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
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: ExtendedGraphAgentsConfigEntry
) -> bool:
    """Unload config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
