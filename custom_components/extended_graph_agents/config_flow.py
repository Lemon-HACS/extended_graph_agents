"""Config flow for Extended Graph Agents."""
from __future__ import annotations
from typing import Any
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.config_entries import ConfigSubentry, ConfigSubentryFlow
from homeassistant.helpers import selector
from .const import (
    CONF_API_KEY,
    CONF_BASE_URL,
    CONF_CHAT_MODEL,
    CONF_GRAPH_ID,
    DEFAULT_BASE_URL,
    DEFAULT_CHAT_MODEL,
    DOMAIN,
)


class ExtendedGraphAgentsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Config flow."""

    VERSION = 1

    @classmethod
    def async_get_options_flow(cls, config_entry):
        return OptionsFlow()

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        errors = {}
        if user_input is not None:
            # Validate API key
            try:
                from openai import AsyncClient

                client = AsyncClient(
                    api_key=user_input[CONF_API_KEY],
                    base_url=user_input.get(CONF_BASE_URL, DEFAULT_BASE_URL),
                )
                await client.models.list()
                await self.async_set_unique_id(user_input[CONF_API_KEY][:10])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title="Extended Graph Agents",
                    data=user_input,
                )
            except Exception:
                errors["base"] = "cannot_connect"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_API_KEY): str,
                vol.Optional(CONF_BASE_URL, default=DEFAULT_BASE_URL): str,
            }),
            errors=errors,
        )

    def async_get_subentry_types(self):
        return {"conversation": ConversationSubentryFlow}


class ConversationSubentryFlow(ConfigSubentryFlow):
    """Subentry flow for conversation agents."""

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(
                title=user_input.get("name", "Graph Agent"),
                data=user_input,
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required("name", default="Graph Agent"): str,
                vol.Optional(CONF_CHAT_MODEL, default=DEFAULT_CHAT_MODEL): selector.selector({
                    "select": {
                        "options": [
                            "gpt-4o",
                            "gpt-4o-mini",
                            "gpt-4-turbo",
                            "gpt-3.5-turbo",
                        ],
                        "custom_value": True,
                        "mode": "dropdown",
                    }
                }),
                vol.Optional(CONF_GRAPH_ID): str,
            }),
        )

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None):
        return await self.async_step_user(user_input)


class OptionsFlow(config_entries.OptionsFlow):
    """Options flow."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Optional(
                    CONF_BASE_URL,
                    default=self.config_entry.data.get(CONF_BASE_URL, DEFAULT_BASE_URL),
                ): str,
            }),
        )
