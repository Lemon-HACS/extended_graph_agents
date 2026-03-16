"""Condition node - evaluates Jinja2 templates to set a route variable without LLM."""
from __future__ import annotations
import logging
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm, template as tmpl
from openai import AsyncClient
from .base import BaseNode, NodeResult
from ..graph_state import GraphState

_LOGGER = logging.getLogger(__name__)


class ConditionNode(BaseNode):
    """Condition node that evaluates Jinja2 templates and sets a state variable.

    Evaluates each entry in ``conditions`` in order; the first whose ``when``
    template renders to a truthy value wins.  If none match, ``default`` is
    used.  No LLM call is made.

    Config example::

        id: check_presence
        type: condition
        output_key: route          # state variable to set
        conditions:
          - when: "{{ is_state('person.john', 'home') }}"
            value: "home"
          - when: "{{ is_state('person.john', 'not_home') }}"
            value: "away"
        default: "unknown"         # optional; used when no condition matches
    """

    async def execute(
        self,
        state: GraphState,
        hass: HomeAssistant,
        client: AsyncClient,
        exposed_entities: list[dict[str, Any]],
        llm_context: llm.LLMContext | None,
    ) -> NodeResult:
        config = self.config
        output_key = config.get("output_key", "route")
        conditions: list[dict[str, Any]] = config.get("conditions", [])
        default_value: str = str(config.get("default", ""))

        template_ctx = state.to_template_context()
        matched_value: str | None = None

        for entry in conditions:
            when_expr = entry.get("when", "")
            value = str(entry.get("value", ""))
            try:
                rendered = tmpl.Template(when_expr, hass).async_render(
                    template_ctx, parse_result=True
                )
                if rendered:
                    matched_value = value
                    break
            except Exception as err:
                _LOGGER.warning(
                    "ConditionNode '%s': template error in '%s': %s",
                    self.node_id,
                    when_expr,
                    err,
                )

        result_value = matched_value if matched_value is not None else default_value

        state.set(output_key, result_value)
        state.node_outputs[self.node_id] = f"Condition: {output_key}={result_value}"

        _LOGGER.debug(
            "ConditionNode '%s': %s=%s (matched=%s)",
            self.node_id,
            output_key,
            result_value,
            matched_value is not None,
        )

        return NodeResult(
            node_id=self.node_id,
            output=f"Condition result: {output_key}={result_value}",
            variables_set={output_key: result_value},
        )
