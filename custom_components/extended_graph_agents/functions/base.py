"""Base function class."""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm


class Function(ABC):
    """Abstract base class for functions."""

    @abstractmethod
    async def execute(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        arguments: dict[str, Any],
        llm_context: llm.LLMContext | None,
        exposed_entities: list[dict[str, Any]],
    ) -> Any:
        """Execute the function."""

    @classmethod
    def validate_schema(cls, config: dict[str, Any]) -> dict[str, Any]:
        """Validate and return the config schema."""
        return config
