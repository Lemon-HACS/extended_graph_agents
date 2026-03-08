"""Graph-based conversation entity."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Any, Literal

from openai import AsyncClient, OpenAIError

from homeassistant.components import conversation
from homeassistant.components.conversation import (
    ChatLog,
    ConversationEntity,
    ConversationEntityFeature,
    ConversationInput,
    ConversationResult,
    async_get_chat_log,
)
from homeassistant.config_entries import ConfigSubentry
from homeassistant.const import MATCH_ALL
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr, intent, llm
from homeassistant.helpers.chat_session import async_get_chat_session
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import (
    CONF_CHAT_MODEL,
    CONF_GRAPH_ID,
    DEFAULT_CHAT_MODEL,
    DOMAIN,
    EVENT_GRAPH_EXECUTION_FINISHED,
)
from .exceptions import GraphNotFound, GraphExecutionError
from .graph_engine import GraphEngine, ExecutionEvent
from .graph_loader import GraphLoader
from .graph_state import GraphState
from .helpers import get_exposed_entities

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up graph conversation entities."""
    for subentry in config_entry.subentries.values():
        if subentry.subentry_type != "conversation":
            continue
        async_add_entities(
            [GraphConversationEntity(config_entry, subentry)],
            config_subentry_id=subentry.subentry_id,
        )


class GraphConversationEntity(
    ConversationEntity,
    conversation.AbstractConversationAgent,
):
    """Graph-based conversation agent entity."""

    _attr_has_entity_name = True
    _attr_name = None
    _attr_supports_streaming = False
    _attr_supported_features = ConversationEntityFeature.CONTROL

    def __init__(self, entry, subentry: ConfigSubentry) -> None:
        self.entry = entry
        self.subentry = subentry
        self._attr_unique_id = subentry.subentry_id
        model = subentry.data.get(CONF_CHAT_MODEL, DEFAULT_CHAT_MODEL)
        self._attr_device_info = dr.DeviceInfo(
            identifiers={(DOMAIN, subentry.subentry_id)},
            name=subentry.title,
            manufacturer="Extended Graph Agents",
            model=model,
            entry_type=dr.DeviceEntryType.SERVICE,
        )

    @property
    def supported_languages(self) -> list[str] | Literal["*"]:
        return MATCH_ALL

    @property
    def _client(self) -> AsyncClient:
        return self.entry.runtime_data

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        conversation.async_set_agent(self.hass, self.entry, self)

    async def async_will_remove_from_hass(self) -> None:
        conversation.async_unset_agent(self.hass, self.entry)
        await super().async_will_remove_from_hass()

    async def async_process(self, user_input: ConversationInput) -> ConversationResult:
        with (
            async_get_chat_session(self.hass, user_input.conversation_id) as session,
            async_get_chat_log(self.hass, session, user_input) as chat_log,
        ):
            return await self._handle_message(user_input, chat_log)

    async def _handle_message(
        self, user_input: ConversationInput, chat_log: ChatLog
    ) -> ConversationResult:
        graph_id = self.subentry.data.get(CONF_GRAPH_ID)
        model = self.subentry.data.get(CONF_CHAT_MODEL, DEFAULT_CHAT_MODEL)
        graphs_dir = (
            Path(self.hass.config.config_dir) / "extended_graph_agents" / "graphs"
        )

        llm_context = user_input.as_llm_context(DOMAIN)
        exposed_entities = get_exposed_entities(self.hass)

        execution_trace: list[dict] = []

        def on_event(event: ExecutionEvent):
            execution_trace.append({"type": event.event_type, **event.data})

        state = GraphState(
            user_input=user_input.text,
            conversation_id=user_input.conversation_id or "",
        )

        try:
            loader = GraphLoader(str(graphs_dir))
            if not graph_id:
                # Use first available graph
                graph_ids = loader.list_ids()
                if not graph_ids:
                    raise GraphNotFound("(none)")
                graph_id = graph_ids[0]

            graph = loader.load_by_id(graph_id)
            engine = GraphEngine(
                hass=self.hass,
                client=self._client,
                default_model=model,
                event_callback=on_event,
            )
            response_text = await engine.execute(
                graph, state, exposed_entities, llm_context
            )
        except GraphNotFound as err:
            _LOGGER.error("Graph not found: %s", err)
            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                f"Graph '{graph_id}' not found. Please create a graph first.",
            )
            return ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )
        except (OpenAIError, GraphExecutionError, HomeAssistantError) as err:
            _LOGGER.error("Graph execution error: %s", err)
            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                f"Error: {err}",
            )
            return ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

        self.hass.bus.async_fire(
            EVENT_GRAPH_EXECUTION_FINISHED,
            {
                "graph_id": graph_id,
                "user_input": user_input.text,
                "trace": execution_trace,
            },
        )

        intent_response = intent.IntentResponse(language=user_input.language)
        intent_response.async_set_speech(response_text)
        return ConversationResult(
            response=intent_response,
            conversation_id=chat_log.conversation_id,
        )
