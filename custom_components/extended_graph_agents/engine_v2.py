"""Graph execution engine v2 — works with GraphV2 format.

Key differences from v1:
- Nodes referenced by name (not id)
- START/END instead of input/output nodes
- Auto-merge when multiple edges arrive at same node
- Inline tools (no skills)
- Dry-run mode (read-only execution)
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from .graph_v2 import GraphV2, NodeDef, ToolDef, EdgeDef, START, END
from .graph_state import GraphState
from .exceptions import GraphExecutionError, RouterError

_LOGGER = logging.getLogger(__name__)

MAX_GRAPH_STEPS = 50


@dataclass
class NodeResult:
    """Result from a node execution."""
    node_name: str
    output: str
    variables_set: dict[str, Any] = field(default_factory=dict)
    token_usage: dict[str, int] = field(default_factory=dict)


@dataclass
class ExecutionEvent:
    """Emitted during graph execution for tracing."""
    event_type: str
    data: dict[str, Any]


class EngineV2:
    """Executes a GraphV2 definition."""

    def __init__(
        self,
        hass: Any,          # HomeAssistant
        client: Any,        # OpenAI AsyncClient
        default_model: str = "gpt-4o",
        event_callback: Callable[[ExecutionEvent], None] | None = None,
        dry_run: bool = False,
    ):
        self.hass = hass
        self.client = client
        self.default_model = default_model
        self.event_callback = event_callback
        self.dry_run = dry_run

    async def execute(
        self,
        graph: GraphV2,
        state: GraphState,
        exposed_entities: list[dict[str, Any]] | None = None,
    ) -> str:
        """Execute the graph and return final response."""
        exposed_entities = exposed_entities or []

        # Wire event callback into state
        if self.event_callback:
            state.event_callback = lambda etype, data: self._emit(ExecutionEvent(etype, data))

        # Start from START edges
        start_nodes = graph.get_start_nodes()
        if not start_nodes:
            raise GraphExecutionError("No START edges defined")

        steps = 0
        # Queue: list of (node_names, is_parallel)
        is_parallel = len(start_nodes) > 1 or any(
            e.parallel for e in graph.edges if e.source == START
        )
        pending: list[tuple[list[str], bool]] = [(start_nodes, is_parallel)]

        while pending and steps < MAX_GRAPH_STEPS:
            node_names, parallel = pending.pop(0)
            steps += 1

            if parallel and len(node_names) > 1:
                results = await self._execute_parallel(graph, node_names, state, exposed_entities)
                # Fan-in: collect all next nodes from parallel results
                seen: set[str] = set()
                fan_in: list[str] = []
                for result in results:
                    for batch in self._resolve_next(graph, result.node_name, state):
                        for name in batch[0]:
                            if name not in seen:
                                seen.add(name)
                                fan_in.append(name)
                if fan_in:
                    pending.append((fan_in, False))
            else:
                for node_name in node_names:
                    result = await self._execute_single(graph, node_name, state, exposed_entities)
                    batches = self._resolve_next(graph, result.node_name, state)
                    pending.extend(batches)

        return self._collect_final_output(graph, state)

    def _resolve_next(
        self,
        graph: GraphV2,
        node_name: str,
        state: GraphState,
    ) -> list[tuple[list[str], bool]]:
        """Resolve next nodes from outgoing edges."""
        outgoing = graph.get_outgoing_edges(node_name)
        if not outgoing:
            return []

        conditional = [e for e in outgoing if e.condition is not None]
        unconditional = [e for e in outgoing if e.condition is None]

        if conditional:
            # For router/condition nodes: match condition against node's output_key
            node = graph.nodes.get(node_name)
            if node and node.type in ("router", "condition"):
                # The route value is stored in state by the node
                # Condition edges have condition = route value
                route_value = state.get(node_name, None)
                matched = [e for e in conditional if e.condition == str(route_value)]
                firing = matched if matched else unconditional
            else:
                firing = unconditional
        else:
            firing = unconditional

        # Filter out END targets
        real_targets = [e for e in firing if e.target != END]
        if not real_targets:
            return []

        # Group parallel vs sequential
        parallel_targets = [e.target for e in real_targets if e.parallel]
        sequential_targets = [e.target for e in real_targets if not e.parallel]

        batches: list[tuple[list[str], bool]] = []
        if parallel_targets:
            batches.append((parallel_targets, True))
        for target in sequential_targets:
            batches.append(([target], False))

        return batches

    def _collect_final_output(self, graph: GraphV2, state: GraphState) -> str:
        """Collect final output from end nodes or last agent output."""
        end_nodes = graph.get_end_nodes()

        # Try end nodes first
        for name in end_nodes:
            if name in state.node_outputs and state.node_outputs[name]:
                node = graph.nodes.get(name)
                if node and node.type == "agent":
                    return state.node_outputs[name]

        # Try any end node output
        for name in end_nodes:
            if name in state.node_outputs and state.node_outputs[name]:
                return state.node_outputs[name]

        # Last agent output
        for name in reversed(list(graph.nodes.keys())):
            node = graph.nodes[name]
            if node.type == "agent" and name in state.node_outputs:
                return state.node_outputs[name]

        # Any output
        if state.node_outputs:
            return list(state.node_outputs.values())[-1]

        return "No response generated"

    # ── Node execution ──

    async def _execute_single(
        self,
        graph: GraphV2,
        node_name: str,
        state: GraphState,
        exposed_entities: list[dict[str, Any]],
    ) -> NodeResult:
        node = graph.nodes.get(node_name)
        if node is None:
            raise GraphExecutionError(f"Node '{node_name}' not found")

        t_start = time.monotonic()
        self._emit(ExecutionEvent("node_started", {
            "node_id": node_name,
            "node_type": node.type,
            "node_name": node.name,
        }))

        try:
            if node.type == "agent":
                result = await self._execute_agent(graph, node, state, exposed_entities)
            elif node.type == "router":
                result = await self._execute_router(graph, node, state)
            elif node.type == "condition":
                result = await self._execute_condition(node, state)
            else:
                raise GraphExecutionError(f"Unknown node type: {node.type}")

            duration_ms = int((time.monotonic() - t_start) * 1000)
            self._emit(ExecutionEvent("node_finished", {
                "node_id": node_name,
                "output": result.output,
                "duration_ms": duration_ms,
                "variables_set": result.variables_set,
                "token_usage": result.token_usage,
            }))
            return result

        except Exception as err:
            duration_ms = int((time.monotonic() - t_start) * 1000)
            self._emit(ExecutionEvent("node_error", {
                "node_id": node_name,
                "error": str(err),
                "duration_ms": duration_ms,
            }))
            raise GraphExecutionError(f"Node '{node_name}' failed: {err}") from err

    async def _execute_agent(
        self,
        graph: GraphV2,
        node: NodeDef,
        state: GraphState,
        exposed_entities: list[dict[str, Any]],
    ) -> NodeResult:
        """Execute an agent node (LLM with tools)."""
        model = node.model or graph.model or self.default_model
        model_params = {**graph.model_params, **node.model_params}

        # Build system prompt
        system_prompt = node.prompt
        if graph.system_prompt_prefix:
            system_prompt = graph.system_prompt_prefix + "\n\n" + system_prompt
        if state.language and state.language != "en":
            system_prompt += f"\n\nAlways respond in the user's language: {state.language}"

        # Build user message with context from previous nodes
        user_content = state.user_input
        if state.node_outputs:
            context_parts = [
                f"[{name}]: {output}"
                for name, output in state.node_outputs.items()
                if name != node.name and not output.startswith("Router decision:")
                and not output.startswith("Condition result:")
            ]
            if context_parts:
                user_content = "\n".join(context_parts) + "\n\nUser: " + user_content

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        # Build tools from inline tool definitions
        tools_spec = []
        for tool in node.tools:
            tools_spec.append({
                "type": "function",
                "function": tool.to_function_spec(),
            })

        # API kwargs
        api_kwargs: dict[str, Any] = {"model": model, "messages": messages}
        for key in ("temperature", "top_p", "max_tokens"):
            if key in model_params:
                api_kwargs[key] = model_params[key]
        if "reasoning_effort" in model_params:
            api_kwargs["reasoning_effort"] = model_params["reasoning_effort"]

        # Output schema (structured JSON output)
        if node.output_schema:
            properties = {}
            required_fields = []
            for f in node.output_schema:
                prop: dict[str, Any] = {"type": f["type"]}
                if f.get("description"):
                    prop["description"] = f["description"]
                if f.get("enum"):
                    prop["enum"] = f["enum"]
                properties[f["key"]] = prop
                required_fields.append(f["key"])
            api_kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "node_output",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": properties,
                        "required": required_fields,
                        "additionalProperties": False,
                    },
                },
            }
        elif tools_spec:
            api_kwargs["tools"] = tools_spec
            api_kwargs["tool_choice"] = "auto"

        # LLM call loop
        max_iterations = node.max_tool_iterations or graph.max_tool_iterations or 10
        final_response = ""
        total_prompt = 0
        total_completion = 0

        for _ in range(max_iterations):
            response = await self.client.chat.completions.create(**api_kwargs)
            usage = getattr(response, "usage", None)
            if usage:
                total_prompt += getattr(usage, "prompt_tokens", 0) or 0
                total_completion += getattr(usage, "completion_tokens", 0) or 0

            choice = response.choices[0]
            message = choice.message

            if message.content:
                final_response = message.content

            if not message.tool_calls:
                break

            # Add assistant message with tool calls
            messages.append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in message.tool_calls
                ],
            })

            # Execute tool calls
            for tc in message.tool_calls:
                func_name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                tool_def = next((t for t in node.tools if t.name == func_name), None)

                if state.event_callback:
                    state.event_callback("tool_called", {
                        "node_id": node.name,
                        "tool_name": func_name,
                        "args": args,
                    })

                if tool_def is None:
                    tool_result = f"Tool '{func_name}' not found"
                elif self.dry_run and tool_def.tool_type == "native":
                    # Dry-run: don't execute service calls
                    tool_result = (
                        f"[DRY RUN] Would call service '{tool_def.service}' "
                        f"with args: {json.dumps(args, ensure_ascii=False)}"
                    )
                else:
                    tool_result = await self._execute_tool(tool_def, args, exposed_entities)

                if state.event_callback:
                    state.event_callback("tool_result", {
                        "node_id": node.name,
                        "tool_name": func_name,
                        "result": tool_result[:2000],
                    })

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_result,
                })

            api_kwargs["messages"] = messages

        state.node_outputs[node.name] = final_response

        # JSON schema output → store in variables
        variables_set: dict[str, Any] = {}
        if node.output_schema and final_response:
            try:
                output_data = json.loads(final_response)
                for key, value in output_data.items():
                    var_key = f"{node.name}.{key}"
                    state.set(var_key, value)
                    variables_set[var_key] = value
            except json.JSONDecodeError:
                pass

        token_usage = {}
        if total_prompt or total_completion:
            token_usage = {
                "prompt_tokens": total_prompt,
                "completion_tokens": total_completion,
                "total_tokens": total_prompt + total_completion,
            }

        return NodeResult(
            node_name=node.name,
            output=final_response,
            variables_set=variables_set,
            token_usage=token_usage,
        )

    async def _execute_router(
        self,
        graph: GraphV2,
        node: NodeDef,
        state: GraphState,
    ) -> NodeResult:
        """Execute a router node (LLM structured output for routing)."""
        model = node.model or graph.model or self.default_model
        model_params = {**graph.model_params, **node.model_params}

        prompt = node.prompt
        # Include context
        if state.node_outputs:
            context = "\n".join(
                f"[{n}]: {o}" for n, o in state.node_outputs.items()
            )
            prompt = f"Context:\n{context}\n\n{prompt}"

        prompt += f"\n\nUser message: {state.user_input}"

        output_key = "route"
        schema = {
            "type": "object",
            "properties": {
                output_key: {
                    "type": "string",
                    "enum": node.routes,
                    "description": "The routing decision",
                }
            },
            "required": [output_key],
            "additionalProperties": False,
        }

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

        response = await self.client.chat.completions.create(**router_kwargs)
        usage = getattr(response, "usage", None)
        content = response.choices[0].message.content

        if not content:
            raise RouterError(f"Router '{node.name}' got empty response")

        output_data = json.loads(content)
        route_value = output_data.get(output_key, "")

        if node.routes and route_value not in node.routes:
            raise RouterError(
                f"Router '{node.name}' returned '{route_value}', "
                f"expected one of {node.routes}"
            )

        # Store route value with node name as key (for edge resolution)
        state.set(node.name, route_value)
        state.node_outputs[node.name] = f"Router decision: {route_value}"

        token_usage = {}
        if usage:
            p = getattr(usage, "prompt_tokens", 0) or 0
            c = getattr(usage, "completion_tokens", 0) or 0
            token_usage = {"prompt_tokens": p, "completion_tokens": c, "total_tokens": p + c}

        return NodeResult(
            node_name=node.name,
            output=f"Router decision: route={route_value}",
            variables_set={node.name: route_value},
            token_usage=token_usage,
        )

    async def _execute_condition(
        self,
        node: NodeDef,
        state: GraphState,
    ) -> NodeResult:
        """Execute a condition node (Jinja2 template evaluation, no LLM)."""
        from homeassistant.helpers import template as tmpl

        template_ctx = state.to_template_context()
        matched_value = None

        for entry in node.conditions:
            when_expr = entry.get("when", "")
            value = str(entry.get("value", ""))
            try:
                rendered = tmpl.Template(when_expr, self.hass).async_render(
                    template_ctx, parse_result=True
                )
                if rendered:
                    matched_value = value
                    break
            except Exception as err:
                _LOGGER.warning("Condition '%s' template error: %s", node.name, err)

        result_value = matched_value if matched_value is not None else (node.default or "")

        # Store with node name as key
        state.set(node.name, result_value)
        state.node_outputs[node.name] = f"Condition result: {result_value}"

        return NodeResult(
            node_name=node.name,
            output=f"Condition result: {result_value}",
            variables_set={node.name: result_value},
        )

    async def _execute_tool(
        self,
        tool: ToolDef,
        args: dict[str, Any],
        exposed_entities: list[dict[str, Any]],
    ) -> str:
        """Execute a single tool (native/template/web)."""
        try:
            if tool.tool_type == "native":
                return await self._execute_native_tool(tool, args)
            elif tool.tool_type == "template":
                return await self._execute_template_tool(tool, args)
            elif tool.tool_type == "web":
                return await self._execute_web_tool(tool, args)
            else:
                return f"Unknown tool type: {tool.tool_type}"
        except Exception as err:
            return f"Tool error: {err}"

    async def _execute_native_tool(self, tool: ToolDef, args: dict[str, Any]) -> str:
        """Execute a native HA service call."""
        from homeassistant.helpers import template as tmpl

        service = tool.service
        if not service:
            return "No service specified"

        parts = service.split(".", 1)
        if len(parts) != 2:
            return f"Invalid service: {service}"

        domain, service_name = parts

        # Render data template with args
        data = {}
        for key, value in args.items():
            data[key] = value

        await self.hass.services.async_call(domain, service_name, data, blocking=True)
        return f"Service {service} called successfully with {json.dumps(data, ensure_ascii=False)}"

    async def _execute_template_tool(self, tool: ToolDef, args: dict[str, Any]) -> str:
        """Execute a Jinja2 template tool."""
        from homeassistant.helpers import template as tmpl

        template_str = tool.template or ""
        rendered = tmpl.Template(template_str, self.hass).async_render(
            {**args}, parse_result=False
        )
        return str(rendered)

    async def _execute_web_tool(self, tool: ToolDef, args: dict[str, Any]) -> str:
        """Execute a web request tool."""
        import aiohttp

        url = tool.url or ""
        # Simple template substitution for URL
        for key, value in args.items():
            url = url.replace(f"{{{{{key}}}}}", str(value))

        async with aiohttp.ClientSession() as session:
            method = tool.method.upper()
            kwargs: dict[str, Any] = {"headers": tool.headers}
            if method in ("POST", "PUT", "PATCH"):
                kwargs["json"] = {**tool.payload, **args}

            async with session.request(method, url, **kwargs) as resp:
                text = await resp.text()
                return text[:32000]  # Limit response size

    async def _execute_parallel(
        self,
        graph: GraphV2,
        node_names: list[str],
        state: GraphState,
        exposed_entities: list[dict[str, Any]],
    ) -> list[NodeResult]:
        tasks = [
            self._execute_single(graph, name, state, exposed_entities)
            for name in node_names
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                raise GraphExecutionError(
                    f"Parallel node '{node_names[i]}' failed: {result}"
                ) from result
            processed.append(result)
        return processed

    def _emit(self, event: ExecutionEvent) -> None:
        if self.event_callback:
            try:
                self.event_callback(event)
            except Exception:
                pass
