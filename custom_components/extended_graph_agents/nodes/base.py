"""Base node class."""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
from ..graph_state import GraphState


@dataclass
class NodeResult:
    """Result from a node execution."""

    node_id: str
    output: str
    variables_set: dict[str, Any] = field(default_factory=dict)
    token_usage: dict[str, int] = field(default_factory=dict)


class BaseNode(ABC):
    """Abstract base node."""

    def __init__(self, node_config: dict[str, Any]):
        self.node_id: str = node_config["id"]
        self.name: str = node_config.get("name", self.node_id)
        self.node_type: str = node_config["type"]
        self.config = node_config

    @abstractmethod
    async def execute(
        self,
        state: GraphState,
        hass: Any,
        client: Any,
        exposed_entities: list[dict[str, Any]],
        llm_context: Any,
    ) -> NodeResult:
        """Execute this node."""
