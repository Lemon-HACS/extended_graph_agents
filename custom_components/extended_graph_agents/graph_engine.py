"""Graph execution engine."""
from __future__ import annotations
import asyncio
import logging
import time
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
        self.event_type = event_type
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
        for node_config in graph.nodes:
            if "model" not in node_config:
                node_config["model"] = graph.model or self.default_model

        # Pass event callback to state so nodes can emit tool events
        if self.event_callback:
            state.event_callback = lambda etype, data: self._emit(ExecutionEvent(etype, data))

        start_node_config = graph.get_start_node()

        steps = 0
        pending: list[tuple[list[str], str]] = [([start_node_config["id"]], "sequential")]

        while pending and steps < MAX_GRAPH_STEPS:
            node_ids, mode = pending.pop(0)
            steps += 1

            if mode == "parallel":
                results = await self._execute_parallel(
                    graph, node_ids, state, exposed_entities, llm_context
                )
                seen_next: set[str] = set()
                fan_in_next: list[str] = []
                for result in results:
                    for batch_ids, _ in self._resolve_next_nodes(graph, result.node_id, state):
                        for nid in batch_ids:
                            if nid not in seen_next:
                                seen_next.add(nid)
                                fan_in_next.append(nid)
                if fan_in_next:
                    pending.append((fan_in_next, "sequential"))
            else:
                for node_id in node_ids:
                    result = await self._execute_single(
                        graph, node_id, state, exposed_entities, llm_context
                    )
                    batches = self._resolve_next_nodes(graph, result.node_id, state)
                    pending.extend(batches)

        return self._collect_final_output(graph, state)

    def _resolve_next_nodes(
        self,
        graph: GraphDefinition,
        node_id: str,
        state: GraphState,
    ) -> list[tuple[list[str], str]]:
        outgoing = graph.get_outgoing_edges(node_id)
        if not outgoing:
            return []

        conditional = [e for e in outgoing if e.condition is not None]
        unconditional = [e for e in outgoing if e.condition is None]

        matched = [
            e for e in conditional
            if str(state.get(e.condition["variable"], "")) == str(e.condition["value"])
        ]

        firing = matched if matched else unconditional
        if not firing:
            return []

        parallel_targets = [e.target for e in firing if e.mode == "parallel"]
        sequential_targets = [e.target for e in firing if e.mode != "parallel"]

        batches: list[tuple[list[str], str]] = []
        if parallel_targets:
            batches.append((parallel_targets, "parallel"))
        for target in sequential_targets:
            batches.append(([target], "sequential"))

        return batches

    def _collect_final_output(self, graph: GraphDefinition, state: GraphState) -> str:
        output_node = graph.output_node
        if output_node is not None:
            output_node_id = output_node["id"]
            if state.node_outputs.get(output_node_id):
                return state.node_outputs[output_node_id]

            incoming_sources = [
                e.source for e in graph.edges if e.target == output_node_id
            ]
            for src_id in incoming_sources:
                if src_id in state.node_outputs and state.node_outputs[src_id]:
                    return state.node_outputs[src_id]

        for node_config in reversed(graph.nodes):
            node_id = node_config["id"]
            if node_id in state.node_outputs and node_config.get("type") == "regular":
                return state.node_outputs[node_id]

        if state.node_outputs:
            return list(state.node_outputs.values())[-1]

        return "No response generated"

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

        t_start = time.monotonic()
        self._emit(
            ExecutionEvent(
                "node_started",
                {"node_id": node_id, "node_type": node_config.get("type"), "node_name": node_config.get("name", node_id)},
            )
        )

        try:
            node = get_node(node_config)
            result = await node.execute(
                state, self.hass, self.client, exposed_entities, llm_context
            )
            duration_ms = int((time.monotonic() - t_start) * 1000)
            self._emit(
                ExecutionEvent(
                    "node_finished",
                    {
                        "node_id": node_id,
                        "output": result.output,
                        "duration_ms": duration_ms,
                        "variables_set": result.variables_set,
                    },
                )
            )
            return result
        except Exception as err:
            duration_ms = int((time.monotonic() - t_start) * 1000)
            self._emit(
                ExecutionEvent(
                    "node_error",
                    {"node_id": node_id, "error": str(err), "duration_ms": duration_ms},
                )
            )
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
