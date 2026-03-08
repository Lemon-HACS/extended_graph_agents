"""Graph execution engine."""
from __future__ import annotations
import asyncio
import logging
from typing import Any, Callable
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm
from openai import AsyncClient
from .graph_state import GraphState
from .graph_loader import GraphDefinition
from .nodes import get_node, NodeResult
from .exceptions import GraphExecutionError, NodeNotFound

_LOGGER = logging.getLogger(__name__)

MAX_GRAPH_STEPS = 50  # prevent infinite loops


class ExecutionEvent:
    """Emitted during graph execution for tracing."""

    def __init__(self, event_type: str, data: dict[str, Any]):
        self.event_type = event_type  # node_started, node_finished, graph_finished
        self.data = data


class GraphEngine:
    """Executes a graph definition."""

    def __init__(
        self,
        hass: HomeAssistant,
        client: AsyncClient,
        default_model: str = "gpt-4o",
        event_callback: Callable[[ExecutionEvent], None] | None = None,
    ):
        self.hass = hass
        self.client = client
        self.default_model = default_model
        self.event_callback = event_callback

    async def execute(
        self,
        graph: GraphDefinition,
        state: GraphState,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None = None,
    ) -> str:
        """Execute the graph and return final response."""
        # Start from first node
        start_node_config = graph.get_start_node()

        # Apply default model to nodes that don't specify one
        for node_config in graph.nodes:
            if "model" not in node_config:
                node_config["model"] = graph.model or self.default_model

        steps = 0
        # Queue of (node_ids_to_execute, execution_mode)
        pending: list[tuple[list[str], str]] = [([start_node_config["id"]], "sequential")]

        while pending and steps < MAX_GRAPH_STEPS:
            node_ids, mode = pending.pop(0)
            steps += 1

            if mode == "parallel":
                results = await self._execute_parallel(
                    graph, node_ids, state, exposed_entities, llm_context
                )
            else:
                results = []
                for node_id in node_ids:
                    result = await self._execute_single(
                        graph, node_id, state, exposed_entities, llm_context
                    )
                    results.append(result)

            # Collect next nodes
            for result in results:
                if result.next_node_ids:
                    pending.append((result.next_node_ids, result.execution_mode))

        # Return last regular node output
        final_output = ""
        for node_config in reversed(graph.nodes):
            node_id = node_config["id"]
            if node_id in state.node_outputs and node_config.get("type") == "regular":
                final_output = state.node_outputs[node_id]
                break

        # Fallback: return last output
        if not final_output and state.node_outputs:
            final_output = list(state.node_outputs.values())[-1]

        return final_output or "No response generated"

    async def _execute_single(
        self,
        graph: GraphDefinition,
        node_id: str,
        state: GraphState,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> NodeResult:
        node_config = graph.get_node(node_id)
        if node_config is None:
            raise NodeNotFound(node_id)

        self._emit(
            ExecutionEvent(
                "node_started",
                {"node_id": node_id, "node_type": node_config.get("type")},
            )
        )

        try:
            node = get_node(node_config)
            result = await node.execute(
                state, self.hass, self.client, exposed_entities, llm_context
            )
            self._emit(
                ExecutionEvent(
                    "node_finished",
                    {
                        "node_id": node_id,
                        "output": result.output[:200],
                    },
                )
            )
            return result
        except Exception as err:
            _LOGGER.error("Node '%s' failed: %s", node_id, err, exc_info=True)
            raise GraphExecutionError(f"Node '{node_id}' failed: {err}") from err

    async def _execute_parallel(
        self,
        graph: GraphDefinition,
        node_ids: list[str],
        state: GraphState,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> list[NodeResult]:
        tasks = [
            self._execute_single(graph, node_id, state, exposed_entities, llm_context)
            for node_id in node_ids
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                _LOGGER.error("Parallel node '%s' failed: %s", node_ids[i], result)
                raise GraphExecutionError(
                    f"Parallel node '{node_ids[i]}' failed: {result}"
                ) from result
            processed.append(result)
        return processed

    def _emit(self, event: ExecutionEvent) -> None:
        if self.event_callback:
            try:
                self.event_callback(event)
            except Exception:
                pass
