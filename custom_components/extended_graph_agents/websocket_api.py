"""WebSocket API for Extended Graph Agents."""
from __future__ import annotations
import logging
from typing import Any
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from .const import DOMAIN, EVENT_GRAPH_SAVED, EVENT_GRAPH_DELETED, EVENT_SKILL_SAVED, EVENT_SKILL_DELETED
from .graph_loader import GraphLoader
from .skill_loader import SkillLoader
from .exceptions import GraphNotFound, InvalidGraph, SkillNotFound, InvalidSkill

_LOGGER = logging.getLogger(__name__)


@callback
def async_setup_websocket_api(hass: HomeAssistant) -> None:
    """Set up websocket API."""
    websocket_api.async_register_command(hass, ws_list_graphs)
    websocket_api.async_register_command(hass, ws_get_graph)
    websocket_api.async_register_command(hass, ws_save_graph)
    websocket_api.async_register_command(hass, ws_delete_graph)
    websocket_api.async_register_command(hass, ws_list_skills)
    websocket_api.async_register_command(hass, ws_get_skill)
    websocket_api.async_register_command(hass, ws_save_skill)
    websocket_api.async_register_command(hass, ws_delete_skill)
    websocket_api.async_register_command(hass, ws_render_template)
    websocket_api.async_register_command(hass, ws_run_graph)


def _get_skill_loader(hass: HomeAssistant) -> SkillLoader:
    from pathlib import Path
    from .const import SKILLS_SUBDIR

    skills_dir = Path(hass.config.config_dir) / SKILLS_SUBDIR
    return SkillLoader(str(skills_dir))


def _get_loader(hass: HomeAssistant) -> GraphLoader:
    from pathlib import Path
    from .const import GRAPHS_SUBDIR

    graphs_dir = Path(hass.config.config_dir) / GRAPHS_SUBDIR
    return GraphLoader(str(graphs_dir))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/list_graphs",
})
@callback
def ws_list_graphs(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader(hass)
    graphs = loader.load_all()
    connection.send_result(
        msg["id"],
        {
            "graphs": [
                {
                    "id": g.id,
                    "name": g.name,
                    "description": g.description,
                    "node_count": len(g.nodes),
                }
                for g in graphs
            ]
        },
    )


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_graph",
    vol.Required("graph_id"): str,
})
@callback
def ws_get_graph(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader(hass)
    try:
        graph = loader.load_by_id(msg["graph_id"])
        connection.send_result(msg["id"], {"graph": graph.to_dict()})
    except GraphNotFound as err:
        connection.send_error(msg["id"], "graph_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_graph",
    vol.Required("graph"): dict,
})
@callback
def ws_save_graph(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader(hass)
    try:
        loader.save(msg["graph"])
        graph_data = msg["graph"]
        hass.bus.async_fire(EVENT_GRAPH_SAVED, {
            "graph_id": graph_data.get("id"),
            "graph_name": graph_data.get("name") or graph_data.get("id"),
        })
        connection.send_result(msg["id"], {"success": True})
    except InvalidGraph as err:
        connection.send_error(msg["id"], "invalid_graph", str(err))
    except Exception as err:
        connection.send_error(msg["id"], "save_failed", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/delete_graph",
    vol.Required("graph_id"): str,
})
@callback
def ws_delete_graph(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader(hass)
    try:
        loader.delete(msg["graph_id"])
        hass.bus.async_fire(EVENT_GRAPH_DELETED, {"graph_id": msg["graph_id"]})
        connection.send_result(msg["id"], {"success": True})
    except GraphNotFound as err:
        connection.send_error(msg["id"], "graph_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/list_skills",
})
@callback
def ws_list_skills(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_skill_loader(hass)
    skills = loader.load_all()
    connection.send_result(
        msg["id"],
        {
            "skills": [
                {
                    "id": s.id,
                    "name": s.name,
                    "group": s.group,
                    "description": s.description,
                    "function_count": len(s.functions),
                }
                for s in skills
            ]
        },
    )


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_skill",
    vol.Required("skill_id"): str,
})
@callback
def ws_get_skill(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_skill_loader(hass)
    try:
        skill = loader.load_by_id(msg["skill_id"])
        connection.send_result(msg["id"], {"skill": skill.to_dict()})
    except SkillNotFound as err:
        connection.send_error(msg["id"], "skill_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_skill",
    vol.Required("skill"): dict,
})
@callback
def ws_save_skill(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_skill_loader(hass)
    try:
        loader.save(msg["skill"])
        skill_data = msg["skill"]
        hass.bus.async_fire(EVENT_SKILL_SAVED, {
            "skill_id": skill_data.get("id"),
            "skill_name": skill_data.get("name") or skill_data.get("id"),
        })
        connection.send_result(msg["id"], {"success": True})
    except InvalidSkill as err:
        connection.send_error(msg["id"], "invalid_skill", str(err))
    except Exception as err:
        connection.send_error(msg["id"], "save_failed", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/render_template",
    vol.Required("template"): str,
})
@callback
def ws_render_template(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    from homeassistant.helpers import template as tmpl

    try:
        result = tmpl.Template(msg["template"], hass).async_render(
            {"user_input": "(preview)", "language": "en", "variables": {}, "node_outputs": {}},
            parse_result=False,
        )
        connection.send_result(msg["id"], {"result": str(result)})
    except Exception as err:
        connection.send_error(msg["id"], "render_error", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/delete_skill",
    vol.Required("skill_id"): str,
})
@callback
def ws_delete_skill(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_skill_loader(hass)
    try:
        loader.delete(msg["skill_id"])
        hass.bus.async_fire(EVENT_SKILL_DELETED, {"skill_id": msg["skill_id"]})
        connection.send_result(msg["id"], {"success": True})
    except SkillNotFound as err:
        connection.send_error(msg["id"], "skill_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/run_graph",
    vol.Required("graph_id"): str,
    vol.Required("user_input"): str,
    vol.Optional("language", default="en"): str,
})
@websocket_api.async_response
async def ws_run_graph(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Run a graph with the given user input and return full execution trace."""
    import uuid
    from pathlib import Path
    from .graph_engine import GraphEngine, ExecutionEvent
    from .graph_state import GraphState
    from .helpers import get_exposed_entities
    from .exceptions import GraphNotFound, GraphExecutionError
    from .const import GRAPHS_SUBDIR, DEFAULT_CHAT_MODEL

    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "no_config", "No Extended Graph Agents config entry found")
        return
    client = entries[0].runtime_data

    graphs_dir_path = Path(hass.config.config_dir) / GRAPHS_SUBDIR
    loader = _get_loader(hass)

    trace: list[dict] = []

    def on_event(event: ExecutionEvent) -> None:
        trace.append({"type": event.event_type, **event.data})

    try:
        graph = loader.load_by_id(msg["graph_id"])
    except GraphNotFound as err:
        connection.send_error(msg["id"], "graph_not_found", str(err))
        return

    state = GraphState(
        user_input=msg["user_input"],
        conversation_id=str(uuid.uuid4()),
        language=msg.get("language", "en"),
    )

    exposed_entities = get_exposed_entities(hass)

    try:
        engine = GraphEngine(
            hass=hass,
            client=client,
            default_model=graph.model or DEFAULT_CHAT_MODEL,
            event_callback=on_event,
        )
        output = await engine.execute(graph, state, exposed_entities)
    except GraphExecutionError as err:
        connection.send_result(msg["id"], {
            "trace": trace,
            "output": None,
            "error": str(err),
        })
        return
    except Exception as err:
        connection.send_error(msg["id"], "execution_failed", str(err))
        return

    connection.send_result(msg["id"], {
        "trace": trace,
        "output": output,
        "error": None,
    })
