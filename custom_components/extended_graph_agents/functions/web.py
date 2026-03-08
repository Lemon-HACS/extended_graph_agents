"""Web scraping/REST function."""
from __future__ import annotations
import logging
from typing import Any
import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers import llm, template as tmpl
from . import register_function
from .base import Function

_LOGGER = logging.getLogger(__name__)
MAX_CONTENT_SIZE = 32000


@register_function("web")
class WebFunction(Function):
    """Makes HTTP requests or scrapes web pages."""

    async def execute(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        arguments: dict[str, Any],
        llm_context: llm.LLMContext | None,
        exposed_entities: list[dict[str, Any]],
    ) -> Any:
        context = {**arguments}
        url_template = config.get("url", "")
        url = tmpl.Template(url_template, hass).async_render(context, parse_result=False)

        method = config.get("method", "GET").upper()
        headers = config.get("headers", {})
        payload = config.get("payload", None)

        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method,
                    url,
                    headers=headers,
                    json=payload if payload else None,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as response:
                    content_type = response.headers.get("Content-Type", "")
                    if "json" in content_type:
                        data = await response.json()
                        return str(data)[:MAX_CONTENT_SIZE]
                    else:
                        text = await response.text()
                        # Basic HTML stripping
                        if "html" in content_type:
                            import re
                            text = re.sub(r'<[^>]+>', ' ', text)
                            text = re.sub(r'\s+', ' ', text).strip()
                        return text[:MAX_CONTENT_SIZE]
        except Exception as err:
            return f"Web request error: {err}"
