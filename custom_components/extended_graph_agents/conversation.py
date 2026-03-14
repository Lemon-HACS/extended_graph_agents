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
from homeassistant.const import MATCH_ALL
from homeassistant.core import HomeAssistant, callback, Event
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr, intent, llm
from homeassistant.helpers.chat_session import async_get_chat_session
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import (
    DEFAULT_CHAT_MODEL,
    DOMAIN,
    EVENT_GRAPH_EXECUTION_FINISHED,
    EVENT_GRAPH_SAVED,
    EVENT_GRAPH_DELETED,
    GRAPHS_SUBDIR,
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
    """Set up graph conversation entities from saved graphs."""
    graphs_dir = Path(hass.config.config_dir) / GRAPHS_SUBDIR
    loader = GraphLoader(str(graphs_dir))

    # Track active entities by graph_id
    entities: dict[str, GraphConversationEntity] = {}

    # Create entities for all existing graphs (executor to avoid blocking event loop)
    initial = []
    for graph in await hass.async_add_executor_job(loader.load_all):
        entity = GraphConversationEntity(config_entry, graph.id, graph.name)
        entities[graph.id] = entity
        initial.append(entity)
    if initial:
        async_add_entities(initial)

    @callback
    def handle_graph_saved(event: Event) -> None:
        graph_id = event.data.get("graph_id")
        graph_name = event.data.get("graph_name") or graph_id
        if not graph_id:
            return
        if graph_id in entities:
            entities[graph_id].update_name(graph_name)
        else:
            entity = GraphConversationEntity(config_entry, graph_id, graph_name)
            entities[graph_id] = entity
            async_add_entities([entity])

    @callback
    def handle_graph_deleted(event: Event) -> None:
        graph_id = event.data.get("graph_id")
        if graph_id and graph_id in entities:
            entity = entities.pop(graph_id)
            hass.async_create_task(entity.async_remove())

    config_entry.async_on_unload(
        hass.bus.async_listen(EVENT_GRAPH_SAVED, handle_graph_saved)
    )
    config_entry.async_on_unload(
        hass.bus.async_listen(EVENT_GRAPH_DELETED, handle_graph_deleted)
    )


class GraphConversationEntity(
    ConversationEntity,
    conversation.AbstractConversationAgent,
):
    """Graph-based conversation agent entity."""

    _attr_has_entity_name = False
    _attr_supports_streaming = False
    _attr_supported_features = ConversationEntityFeature.CONTROL

    def __init__(self, entry, graph_id: str, graph_name: str) -> None:
        self.entry = entry
        self.graph_id = graph_id
        self._attr_unique_id = f"{DOMAIN}_{graph_id}"
        self._attr_name = graph_name
        self._attr_device_info = dr.DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Extended Graph Agents",
            manufacturer="Extended Graph Agents",
            entry_type=dr.DeviceEntryType.SERVICE,
        )

    @property
    def supported_languages(self) -> list[str] | Literal["*"]:
        return MATCH_ALL

    @property
    def _client(self) -> AsyncClient:
        return self.entry.runtime_data

    def update_name(self, new_name: str) -> None:
        self._attr_name = new_name
        self.async_write_ha_state()

    async def async_process(self, user_input: ConversationInput) -> ConversationResult:
        with (
            async_get_chat_session(self.hass, user_input.conversation_id) as session,
            async_get_chat_log(self.hass, session, user_input) as chat_log,
        ):
            return await self._handle_message(user_input, chat_log)

    async def _handle_message(
        self, user_input: ConversationInput, chat_log: ChatLog
    ) -> ConversationResult:
        graphs_dir = Path(self.hass.config.config_dir) / GRAPHS_SUBDIR
        llm_context = user_input.as_llm_context(DOMAIN)
        exposed_entities = get_exposed_entities(self.hass)

        execution_trace: list[dict] = []

        def on_event(event: ExecutionEvent):
            execution_trace.append({"type": event.event_type, **event.data})

        state = GraphState(
            user_input=user_input.text,
            conversation_id=user_input.conversation_id or "",
            language=user_input.language or "en",
        )

        try:
            loader = GraphLoader(str(graphs_dir))
            graph = await self.hass.async_add_executor_job(loader.load_by_id, self.graph_id)
            engine = GraphEngine(
                hass=self.hass,
                client=self._client,
                default_model=graph.model,
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
                f"Graph '{self.graph_id}' not found.",
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
                "graph_id": self.graph_id,
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
