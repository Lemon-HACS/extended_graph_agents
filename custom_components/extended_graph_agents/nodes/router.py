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
        model_params: dict[str, Any] = config.get("model_params") or {}
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
            router_kwargs: dict[str, Any] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "routing_decision",
                        "strict": True,
                        "schema": schema,
                    },
                },
                "max_completion_tokens": model_params.get("max_tokens", 200),
            }
            for key in ("temperature", "top_p"):
                if key in model_params:
                    router_kwargs[key] = model_params[key]
            if "reasoning_effort" in model_params:
                router_kwargs["reasoning_effort"] = model_params["reasoning_effort"]
            response = await client.chat.completions.create(**router_kwargs)
            content = response.choices[0].message.content
            if not content:
                raise RouterError(
                    f"Router got empty response from model '{model}'. "
                    "The model may not support json_schema structured output."
                )
            output_data = json.loads(content)
            route_value = output_data.get(output_key, "")
            if values and route_value not in values:
                raise RouterError(
                    f"Router returned invalid value '{route_value}' "
                    f"(expected one of {values}). Raw response: {content}"
                )
        except (RouterError, json.JSONDecodeError) as err:
            _LOGGER.error("Router failed: %s", err)
            raise RouterError(str(err)) from err
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
