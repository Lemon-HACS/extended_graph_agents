"""Regular node - LLM with functions/skills."""
from __future__ import annotations
import json
import logging
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm, template as tmpl
from openai import AsyncClient
from .base import BaseNode, NodeResult
from ..graph_state import GraphState
from ..exceptions import ParseArgumentsFailed

_LOGGER = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 10


class RegularNode(BaseNode):
    """Regular node that runs LLM with functions."""

    async def execute(
        self,
        state: GraphState,
        hass: HomeAssistant,
        client: AsyncClient,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> NodeResult:
        from ..functions import get_function

        config = self.config
        model = config.get("model", "gpt-4o")
        raw_prompt = config.get("prompt", "")

        # Render system prompt
        system_prompt = tmpl.Template(raw_prompt, hass).async_render(
            state.to_template_context(), parse_result=False
        )

        # Build messages: include previous node outputs as context
        user_content = state.user_input
        if state.node_outputs:
            context_parts = [
                f"[Previous context from graph: {outputs}]"
                for node_id, outputs in state.node_outputs.items()
                if node_id != self.node_id
            ]
            if context_parts:
                user_content = "\n".join(context_parts) + "\n\nUser: " + user_content

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        # Build tools from function configs
        function_tools_config = config.get("functions", [])
        tools = []
        for func_tool in function_tools_config:
            if "spec" in func_tool:
                tools.append({
                    "type": "function",
                    "function": func_tool["spec"],
                })

        # LLM call loop with tool execution
        api_kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
        }
        if tools:
            api_kwargs["tools"] = tools
            api_kwargs["tool_choice"] = "auto"

        final_response = ""

        for _ in range(MAX_TOOL_ITERATIONS):
            response = await client.chat.completions.create(**api_kwargs)
            choice = response.choices[0]
            message = choice.message

            if message.content:
                final_response = message.content

            # Check for tool calls
            if not message.tool_calls:
                break

            # Add assistant message
            messages.append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in message.tool_calls
                ],
            })

            # Execute each tool call
            for tool_call in message.tool_calls:
                func_name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError as err:
                    raise ParseArgumentsFailed(tool_call.function.arguments) from err

                # Find matching function config
                func_config = next(
                    (
                        f
                        for f in function_tools_config
                        if f.get("spec", {}).get("name") == func_name
                    ),
                    None,
                )
                if func_config is None:
                    tool_result = f"Function {func_name} not found"
                else:
                    func_impl = get_function(func_config["function"]["type"])
                    result = await func_impl.execute(
                        hass,
                        func_config["function"],
                        args,
                        llm_context,
                        exposed_entities,
                    )
                    tool_result = str(result)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result,
                })

            api_kwargs["messages"] = messages

        # Store result in state
        state.node_outputs[self.node_id] = final_response

        return NodeResult(
            node_id=self.node_id,
            output=final_response,
        )
