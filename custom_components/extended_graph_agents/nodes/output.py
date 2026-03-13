"""Output node - endpoint marker that designates the final response source."""
from __future__ import annotations
import logging
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm, template as tmpl
from openai import AsyncClient
from .base import BaseNode, NodeResult
from ..graph_state import GraphState

_LOGGER = logging.getLogger(__name__)


class OutputNode(BaseNode):
    """Output node that marks the final response endpoint.

    If `output_template` is configured, renders it as a Jinja2 template
    (with full state context) and uses the result as the final response.
    Otherwise, the engine's _collect_final_output falls back to the first
    incoming node's output.
    """

    async def execute(
        self,
        state: GraphState,
        hass: HomeAssistant,
        client: AsyncClient,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> NodeResult:
        output_template = self.config.get("output_template", "")
        if output_template:
            try:
                rendered = tmpl.Template(output_template, hass).async_render(
                    state.to_template_context(), parse_result=False
                )
                state.node_outputs[self.node_id] = rendered
                return NodeResult(node_id=self.node_id, output=rendered)
            except Exception as err:
                _LOGGER.warning("Output node template render failed: %s", err)

        return NodeResult(node_id=self.node_id, output="")
