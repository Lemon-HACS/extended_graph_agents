"""Router node - LLM decides a route value and stores it in state."""
from __future__ import annotations
import json
import logging
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm, template as tmpl
from openai import AsyncClient
from .base import BaseNode, NodeResult
from ..graph_state import GraphState
from ..exceptions import RouterError

_LOGGER = logging.getLogger(__name__)


class RouterNode(BaseNode):
    """Router node that uses LLM to decide a route value."""

    async def execute(
        self,
        state: GraphState,
        hass: HomeAssistant,
        client: AsyncClient,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> NodeResult:
        config = self.config
        model = config.get("model", "gpt-4o")
        output_key = config.get("output_key", "route")

        # Render prompt
        raw_prompt = config.get("prompt", "")
        prompt = tmpl.Template(raw_prompt, hass).async_render(
            state.to_template_context(), parse_result=False
        )

        # Build JSON schema for structured output.
        # `values` lists the valid enum options shown to the LLM.
        values = config.get("values", [])
        if values:
            schema = {
                "type": "object",
                "properties": {
                    output_key: {
                        "type": "string",
                        "enum": values,
                        "description": "The routing decision",
                    }
                },
                "required": [output_key],
                "additionalProperties": False,
            }
        else:
            schema = {
                "type": "object",
                "properties": {output_key: {"type": "string"}},
                "required": [output_key],
                "additionalProperties": False,
            }

        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "routing_decision",
                        "strict": True,
                        "schema": schema,
                    },
                },
                max_completion_tokens=200,
            )
            raw_output = response.choices[0].message.content or "{}"
            output_data = json.loads(raw_output)
            route_value = output_data.get(output_key, "")
        except Exception as err:
            _LOGGER.error("Router LLM call failed: %s", err)
            raise RouterError(f"Router failed: {err}") from err

        # Store route value in state — the engine resolves outgoing edges
        state.set(output_key, route_value)
        state.node_outputs[self.node_id] = f"Routed to: {route_value}"

        return NodeResult(
            node_id=self.node_id,
            output=f"Router decision: {output_key}={route_value}",
            variables_set={output_key: route_value},
        )
