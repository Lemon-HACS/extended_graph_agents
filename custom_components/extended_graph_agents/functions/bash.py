"""Bash execution function."""
from __future__ import annotations
import asyncio
import logging
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm
from . import register_function
from .base import Function

_LOGGER = logging.getLogger(__name__)
TIMEOUT = 30
MAX_OUTPUT = 10000

DENY_PATTERNS = [
    "rm -rf",
    "mkfs",
    "dd if=",
    "format",
    "> /dev/",
    "shutdown",
    "reboot",
]


@register_function("bash")
class BashFunction(Function):
    """Executes a bash command."""

    async def execute(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        arguments: dict[str, Any],
        llm_context: llm.LLMContext | None,
        exposed_entities: list[dict[str, Any]],
    ) -> Any:
        command = arguments.get("command", config.get("command", ""))
        for pattern in DENY_PATTERNS:
            if pattern in command:
                return f"Command denied: contains forbidden pattern '{pattern}'"

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=TIMEOUT
            )
            output = stdout.decode()[:MAX_OUTPUT]
            if stderr:
                output += f"\nSTDERR: {stderr.decode()[:1000]}"
            return output or "(no output)"
        except asyncio.TimeoutError:
            return f"Command timed out after {TIMEOUT}s"
        except Exception as err:
            return f"Command error: {err}"
