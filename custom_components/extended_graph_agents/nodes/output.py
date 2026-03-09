"""Output node - endpoint marker that designates the final response source."""
from __future__ import annotations
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm
from openai import AsyncClient
from .base import BaseNode, NodeResult
from ..graph_state import GraphState


class OutputNode(BaseNode):
    """Output node that marks the final response endpoint.

    This node itself does not execute LLM calls.
    The engine uses 'input_from' to determine which node's output is the final response.
    """

    async def execute(
        self,
        state: GraphState,
        hass: HomeAssistant,
        client: AsyncClient,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> NodeResult:
        # Collect output from connected source nodes
        input_from = self.config.get("input_from", [])
        if isinstance(input_from, str):
            input_from = [input_from]

        final_output = ""
        for src_id in input_from:
            if src_id in state.node_outputs:
                final_output = state.node_outputs[src_id]
                break

        state.node_outputs[self.node_id] = final_output
        return NodeResult(
            node_id=self.node_id,
            output=final_output,
        )
