"""SQLite function."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm
from . import register_function
from .base import Function

_LOGGER = logging.getLogger(__name__)


@register_function("sqlite")
class SqliteFunction(Function):
    """Execute SQLite queries."""

    async def execute(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        arguments: dict[str, Any],
        llm_context: llm.LLMContext | None,
        exposed_entities: list[dict[str, Any]],
    ) -> Any:
        import aiosqlite

        query = arguments.get("query", config.get("query", ""))
        db_path = config.get(
            "db_path",
            str(Path(hass.config.config_dir) / "home-assistant_v2.db"),
        )

        if not query:
            return "No query provided"

        # Basic safety check
        query_upper = query.upper().strip()
        allowed_starts = ("SELECT", "WITH", "EXPLAIN")
        if not any(query_upper.startswith(s) for s in allowed_starts):
            if not config.get("allow_write", False):
                return "Only SELECT queries are allowed by default"

        try:
            async with aiosqlite.connect(db_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute(query) as cursor:
                    rows = await cursor.fetchall()
                    if rows:
                        columns = [desc[0] for desc in cursor.description]
                        result = [dict(zip(columns, row)) for row in rows]
                        return str(result[:100])  # limit rows
                    return "Query returned no results"
        except Exception as err:
            return f"SQLite error: {err}"
