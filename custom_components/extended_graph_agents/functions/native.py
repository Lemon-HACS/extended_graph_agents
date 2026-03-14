"""Native HA service function."""
from __future__ import annotations
import logging
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm, template as tmpl
from homeassistant.exceptions import HomeAssistantError
from . import register_function
from .base import Function

_LOGGER = logging.getLogger(__name__)


@register_function("native")
class NativeFunction(Function):
    """Calls a Home Assistant service."""

    async def execute(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        arguments: dict[str, Any],
        llm_context: llm.LLMContext | None,
        exposed_entities: list[dict[str, Any]],
    ) -> Any:
        service = config.get("service", "")
        if "." not in service:
            domain = config.get("domain", "")
            service_name = service
        else:
            domain, service_name = service.split(".", 1)

        # Render data templates
        data = config.get("data", {})
        rendered_data = {}
        context = {**arguments}
        for key, value in data.items():
            if isinstance(value, str):
                rendered = tmpl.Template(value, hass).async_render(context, parse_result=False)
                rendered_data[key] = rendered
            else:
                rendered_data[key] = value

        service_data = {**rendered_data}

        try:
            await hass.services.async_call(
                domain,
                service_name,
                service_data,
                blocking=True,
            )
            return f"Service {domain}.{service_name} called successfully"
        except HomeAssistantError as err:
            return f"Error calling service: {err}"
