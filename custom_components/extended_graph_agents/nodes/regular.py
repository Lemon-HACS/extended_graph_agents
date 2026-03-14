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
        model_params: dict[str, Any] = config.get("model_params") or {}
        system_prompt_prefix: str = config.get("system_prompt_prefix", "")
        max_tool_iterations: int = config.get("max_tool_iterations", MAX_TOOL_ITERATIONS)
        raw_prompt = config.get("prompt", "")

        # Render system prompt
        system_prompt = tmpl.Template(raw_prompt, hass).async_render(
            state.to_template_context(), parse_result=False
        )
        if system_prompt_prefix:
            system_prompt = system_prompt_prefix + "\n\n" + system_prompt
        if state.language and state.language != "en":
            system_prompt += f"\n\nAlways respond in the user's language: {state.language}"

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

        # Build tools from skills
        function_tools_config: list[dict] = []
        skill_ids = config.get("skills", [])
        if skill_ids:
            from pathlib import Path
            from ..skill_loader import SkillLoader
            from ..const import SKILLS_SUBDIR
            skills_dir = Path(hass.config.config_dir) / SKILLS_SUBDIR
            loader = SkillLoader(str(skills_dir))
            seen_names: set[str] = set()
            for skill_id in skill_ids:
                try:
                    skill = loader.load_by_id(skill_id)
                    for ft in skill.functions:
                        spec_name = ft.get("spec", {}).get("name")
                        if spec_name and spec_name not in seen_names:
                            seen_names.add(spec_name)
                            function_tools_config.append(ft)
                except Exception as err:
                    _LOGGER.warning("Could not load skill '%s': %s", skill_id, err)

        tools = []
        for func_tool in function_tools_config:
            if "spec" in func_tool:
                tools.append({
                    "type": "function",
                    "function": func_tool["spec"],
                })

        # JSON output schema (structured output mode)
        output_schema = config.get("output_schema", [])
        json_schema_format = None
        if output_schema:
            properties = {}
            required_fields = []
            for field in output_schema:
                prop: dict[str, Any] = {"type": field["type"]}
                if field.get("description"):
                    prop["description"] = field["description"]
                if field.get("enum"):
                    prop["enum"] = field["enum"]
                properties[field["key"]] = prop
                required_fields.append(field["key"])
            json_schema_format = {
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

        # LLM call loop with tool execution
        api_kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
        }
        for key in ("temperature", "top_p", "max_tokens"):
            if key in model_params:
                api_kwargs[key] = model_params[key]
        if "reasoning_effort" in model_params:
            api_kwargs["reasoning_effort"] = model_params["reasoning_effort"]
        if json_schema_format:
            # Structured output mode: disable tools to avoid conflicts
            api_kwargs["response_format"] = json_schema_format
        elif tools:
            api_kwargs["tools"] = tools
            api_kwargs["tool_choice"] = "auto"

        final_response = ""

        for _ in range(max_tool_iterations):
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
                    if state.event_callback:
                        state.event_callback("tool_called", {
                            "node_id": self.node_id,
                            "tool_name": func_name,
                            "args": args,
                        })
                    func_impl = get_function(func_config["function"]["type"])
                    result = await func_impl.execute(
                        hass,
                        func_config["function"],
                        args,
                        llm_context,
                        exposed_entities,
                    )
                    tool_result = str(result)
                    if state.event_callback:
                        state.event_callback("tool_result", {
                            "node_id": self.node_id,
                            "tool_name": func_name,
                            "result": tool_result[:2000],
                        })

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result,
                })

            api_kwargs["messages"] = messages

        # Store result in state
        state.node_outputs[self.node_id] = final_response

        # If JSON mode, parse output and store each key as "{node_id}.{key}" in state
        variables_set: dict[str, Any] = {}
        if output_schema and final_response:
            try:
                output_data = json.loads(final_response)
                for key, value in output_data.items():
                    var_key = f"{self.node_id}.{key}"
                    state.set(var_key, value)
                    variables_set[var_key] = value
            except json.JSONDecodeError:
                _LOGGER.warning(
                    "Node '%s' JSON output could not be parsed: %s",
                    self.node_id,
                    final_response[:200],
                )

        return NodeResult(
            node_id=self.node_id,
            output=final_response,
            variables_set=variables_set,
        )
