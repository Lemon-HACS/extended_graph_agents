"""Merge node - combines parallel branch outputs without LLM."""
from __future__ import annotations
import logging
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm, template as tmpl
from openai import AsyncClient
from .base import BaseNode, NodeResult
from ..graph_state import GraphState

_LOGGER = logging.getLogger(__name__)


class MergeNode(BaseNode):
    """Merges parallel branch outputs without LLM.

    Supports three strategies:
    - ``concat``: join all node_outputs with a separator (default)
    - ``last``: use only the last node output
    - ``template``: render a Jinja2 template with node_outputs context

    Config example::

        id: merge_results
        type: merge
        merge_strategy: concat    # concat | last | template
        separator: "\\n\\n"
        merge_template: "{{ node_outputs['search'] }}\\n---\\n{{ node_outputs['analysis'] }}"
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
        strategy = config.get("merge_strategy", "concat")
        separator = config.get("separator", "\n\n")
        template_str = config.get("merge_template", "")

        if strategy == "template" and template_str:
            try:
                template_ctx = state.to_template_context()
                output = tmpl.Template(template_str, hass).async_render(
                    template_ctx, parse_result=False
                )
            except Exception as err:
                _LOGGER.warning(
                    "MergeNode '%s': template error: %s", self.node_id, err
                )
                output = f"[Template error: {err}]"
        elif strategy == "last":
            outputs = list(state.node_outputs.values())
            output = outputs[-1] if outputs else ""
        else:  # concat
            output = separator.join(state.node_outputs.values())

        state.node_outputs[self.node_id] = output

        _LOGGER.debug(
            "MergeNode '%s': strategy=%s, output_len=%d",
            self.node_id,
            strategy,
            len(output),
        )

        return NodeResult(
            node_id=self.node_id,
            output=output,
        )
