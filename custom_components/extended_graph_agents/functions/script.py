"""Script function."""
from __future__ import annotations
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm
from homeassistant.exceptions import HomeAssistantError
from . import register_function
from .base import Function


@register_function("script")
class ScriptFunction(Function):
    """Runs a HA script."""

    async def execute(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        arguments: dict[str, Any],
        llm_context: llm.LLMContext | None,
        exposed_entities: list[dict[str, Any]],
    ) -> Any:
        sequence = config.get("sequence", [])
        try:
            from homeassistant.helpers.script import Script
            script = Script(
                hass,
                sequence,
                "extended_graph_agents_script",
                "extended_graph_agents",
            )
            await script.async_run(run_variables=arguments)
            return "Script executed successfully"
        except HomeAssistantError as err:
            return f"Script error: {err}"
