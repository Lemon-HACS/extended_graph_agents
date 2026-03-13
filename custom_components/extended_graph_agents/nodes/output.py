"""Output node - endpoint marker that designates the final response source."""
from __future__ import annotations
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm
from openai import AsyncClient
from .base import BaseNode, NodeResult
from ..graph_state import GraphState


class OutputNode(BaseNode):
    """Output node that marks the final response endpoint."""

    async def execute(
        self,
        state: GraphState,
        hass: HomeAssistant,
        client: AsyncClient,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> NodeResult:
        # The engine's _collect_final_output resolves the actual response
        # by looking at which nodes have edges pointing to this output node.
        return NodeResult(node_id=self.node_id, output="")
