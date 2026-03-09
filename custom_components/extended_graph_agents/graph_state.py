"""Graph execution state."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class GraphState:
    """State passed through graph nodes."""

    user_input: str
    conversation_id: str
    language: str = "en"
    variables: dict[str, Any] = field(default_factory=dict)
    node_outputs: dict[str, str] = field(default_factory=dict)  # node_id -> output text
    messages: list[dict[str, Any]] = field(default_factory=list)

    def get(self, key: str, default: Any = None) -> Any:
        if key == "user_input":
            return self.user_input
        if key == "conversation_id":
            return self.conversation_id
        return self.variables.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self.variables[key] = value

    def to_template_context(self) -> dict[str, Any]:
        return {
            "state": self,
            "user_input": self.user_input,
            "language": self.language,
            "variables": self.variables,
            "node_outputs": self.node_outputs,
        }
