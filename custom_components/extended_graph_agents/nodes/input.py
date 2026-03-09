"""Input node - entry point that passes user input to the graph."""
from __future__ import annotations
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm
from openai import AsyncClient
from .base import BaseNode, NodeResult
from ..graph_state import GraphState


class InputNode(BaseNode):
    """Input node that starts graph execution with user input."""

    async def execute(
        self,
        state: GraphState,
        hass: HomeAssistant,
        client: AsyncClient,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> NodeResult:
        # Store user input as this node's output and pass to next nodes
        state.node_outputs[self.node_id] = state.user_input
        next_nodes = self.config.get("next", [])
        if isinstance(next_nodes, str):
            next_nodes = [next_nodes]

        return NodeResult(
            node_id=self.node_id,
            output=state.user_input,
            next_node_ids=next_nodes,
            execution_mode="sequential",
        )
