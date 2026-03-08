"""File read/write function."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm
from . import register_function
from .base import Function

_LOGGER = logging.getLogger(__name__)
MAX_FILE_SIZE = 1024 * 1024  # 1 MB
WORKSPACE = "extended_graph_agents"


@register_function("file")
class FileFunction(Function):
    """Read, write, or edit files within workspace."""

    def _get_safe_path(self, hass: HomeAssistant, relative_path: str) -> Path:
        workspace = Path(hass.config.config_dir) / WORKSPACE
        workspace.mkdir(parents=True, exist_ok=True)
        target = (workspace / relative_path).resolve()
        if not str(target).startswith(str(workspace.resolve())):
            raise ValueError(f"Path escapes workspace: {relative_path}")
        return target

    async def execute(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        arguments: dict[str, Any],
        llm_context: llm.LLMContext | None,
        exposed_entities: list[dict[str, Any]],
    ) -> Any:
        operation = arguments.get("operation", config.get("operation", "read"))
        path_str = arguments.get("path", config.get("path", ""))

        try:
            path = self._get_safe_path(hass, path_str)
        except ValueError as err:
            return str(err)

        if operation == "read":
            if not path.exists():
                return f"File not found: {path_str}"
            if path.stat().st_size > MAX_FILE_SIZE:
                return "File too large (>1MB)"
            return await hass.async_add_executor_job(path.read_text)
        elif operation == "write":
            content = arguments.get("content", "")
            path.parent.mkdir(parents=True, exist_ok=True)
            await hass.async_add_executor_job(path.write_text, content)
            return f"Written to {path_str}"
        elif operation == "append":
            content = arguments.get("content", "")
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "a") as f:
                f.write(content)
            return f"Appended to {path_str}"
        else:
            return f"Unknown operation: {operation}"
