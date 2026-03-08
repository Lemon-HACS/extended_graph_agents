"""Template function."""
from __future__ import annotations
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm, template as tmpl
from . import register_function
from .base import Function


@register_function("template")
class TemplateFunction(Function):
    """Renders a Jinja2 template."""

    async def execute(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        arguments: dict[str, Any],
        llm_context: llm.LLMContext | None,
        exposed_entities: list[dict[str, Any]],
    ) -> Any:
        template_str = config.get("value_template", "")
        context = {**arguments, "exposed_entities": exposed_entities}
        result = tmpl.Template(template_str, hass).async_render(context, parse_result=False)
        return str(result)
