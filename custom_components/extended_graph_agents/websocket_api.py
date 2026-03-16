"""WebSocket API for Extended Graph Agents."""
from __future__ import annotations
import logging
from typing import Any
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from .const import DOMAIN, EVENT_GRAPH_SAVED, EVENT_GRAPH_DELETED, EVENT_SKILL_SAVED, EVENT_SKILL_DELETED
from .graph_loader import GraphLoader, GraphDefinition
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
    websocket_api.async_register_command(hass, ws_ai_assist)
    websocket_api.async_register_command(hass, ws_run_skill_test)


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
@websocket_api.async_response
async def ws_list_graphs(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader(hass)
    graphs = await hass.async_add_executor_job(loader.load_all)
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
@websocket_api.async_response
async def ws_get_graph(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader(hass)
    try:
        graph = await hass.async_add_executor_job(loader.load_by_id, msg["graph_id"])
        connection.send_result(msg["id"], {"graph": graph.to_dict()})
    except GraphNotFound as err:
        connection.send_error(msg["id"], "graph_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_graph",
    vol.Required("graph"): dict,
})
@websocket_api.async_response
async def ws_save_graph(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader(hass)
    try:
        await hass.async_add_executor_job(loader.save, msg["graph"])
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
@websocket_api.async_response
async def ws_delete_graph(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader(hass)
    try:
        await hass.async_add_executor_job(loader.delete, msg["graph_id"])
        hass.bus.async_fire(EVENT_GRAPH_DELETED, {"graph_id": msg["graph_id"]})
        connection.send_result(msg["id"], {"success": True})
    except GraphNotFound as err:
        connection.send_error(msg["id"], "graph_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/list_skills",
})
@websocket_api.async_response
async def ws_list_skills(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_skill_loader(hass)
    skills = await hass.async_add_executor_job(loader.load_all)
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
@websocket_api.async_response
async def ws_get_skill(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_skill_loader(hass)
    try:
        skill = await hass.async_add_executor_job(loader.load_by_id, msg["skill_id"])
        connection.send_result(msg["id"], {"skill": skill.to_dict()})
    except SkillNotFound as err:
        connection.send_error(msg["id"], "skill_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_skill",
    vol.Required("skill"): dict,
})
@websocket_api.async_response
async def ws_save_skill(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_skill_loader(hass)
    try:
        await hass.async_add_executor_job(loader.save, msg["skill"])
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
@websocket_api.async_response
async def ws_delete_skill(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_skill_loader(hass)
    try:
        await hass.async_add_executor_job(loader.delete, msg["skill_id"])
        hass.bus.async_fire(EVENT_SKILL_DELETED, {"skill_id": msg["skill_id"]})
        connection.send_result(msg["id"], {"success": True})
    except SkillNotFound as err:
        connection.send_error(msg["id"], "skill_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/ai_assist",
    vol.Required("scope"): vol.In(["graph", "node", "skill", "auto"]),
    vol.Required("request"): str,
    vol.Required("current_yaml"): str,
    vol.Optional("messages", default=[]): list,
    vol.Optional("context", default={}): dict,
    vol.Optional("language", default="en"): str,
    vol.Optional("include_ha_context", default=False): bool,
    vol.Optional("model"): str,
})
@websocket_api.async_response
async def ws_ai_assist(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """AI 어시스턴트: 자연어 요청을 받아 YAML을 생성/수정해 반환."""
    import json
    import yaml as pyyaml
    from .const import DEFAULT_AI_ASSIST_MODEL

    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "no_config", "No Extended Graph Agents config entry found")
        return
    client = entries[0].runtime_data

    scope = msg["scope"]
    context = msg.get("context", {})
    language = msg.get("language", "en")
    ai_model = msg.get("model") or DEFAULT_AI_ASSIST_MODEL

    # auto 스코프는 별도 처리
    if scope == "auto":
        await _handle_auto_generate(hass, connection, msg, client, language, ai_model)
        return

    system_prompt = _build_ai_assist_prompt(scope, context, language)

    # HA 컨텍스트 포함
    if msg.get("include_ha_context", False):
        system_prompt += _build_ha_context_section(hass)

    history = msg.get("messages", [])[-10:]
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({
        "role": "user",
        "content": (
            f"현재 YAML:\n```yaml\n{msg['current_yaml']}\n```\n\n"
            f"요청: {msg['request']}\n\n"
            'JSON으로 응답하세요: {"yaml": "...", "explanation": "..."}'
        ),
    })

    try:
        response = await client.chat.completions.create(
            model=ai_model,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=6000,
            temperature=0.3,
        )
        parsed = json.loads(response.choices[0].message.content)

        generated_yaml = parsed.get("yaml", "")
        try:
            pyyaml.safe_load(generated_yaml)
        except pyyaml.YAMLError as yaml_err:
            connection.send_error(msg["id"], "invalid_yaml", f"LLM이 유효하지 않은 YAML을 생성했습니다: {yaml_err}")
            return

        connection.send_result(msg["id"], {
            "yaml": generated_yaml,
            "explanation": parsed.get("explanation", ""),
        })
    except json.JSONDecodeError as err:
        connection.send_error(msg["id"], "parse_error", f"LLM 응답 파싱 실패: {err}")
    except Exception as err:
        _LOGGER.exception("AI assist error")
        connection.send_error(msg["id"], "ai_error", str(err))


def _build_ha_context_section(hass: HomeAssistant) -> str:
    """HA 엔티티·서비스 컨텍스트 문자열을 생성한다."""
    states = hass.states.async_all()

    # 도메인별 엔티티 그룹핑
    RELEVANT_DOMAINS = {
        "light", "switch", "climate", "cover", "media_player",
        "input_boolean", "input_number", "input_select", "input_text",
        "script", "automation", "notify", "camera", "alarm_control_panel",
        "lock", "fan", "vacuum", "water_heater", "humidifier", "sensor",
        "binary_sensor", "person", "device_tracker",
    }
    groups: dict[str, list[str]] = {}
    for s in states:
        domain = s.entity_id.split(".")[0]
        if domain in RELEVANT_DOMAINS:
            groups.setdefault(domain, []).append(
                f"  - {s.entity_id} ({s.attributes.get('friendly_name', '')}): {s.state}"
            )

    entity_section = "\n".join(
        f"### {domain} ({len(items)}개)\n" + "\n".join(items[:20])
        for domain, items in sorted(groups.items())
        if items
    )

    # 제어 가능한 서비스만 포함
    CONTROL_DOMAINS = {
        "light", "switch", "climate", "cover", "media_player",
        "input_boolean", "input_number", "input_select", "input_text",
        "script", "automation", "notify", "lock", "fan",
        "vacuum", "water_heater", "humidifier",
    }
    services = hass.services.async_services()
    service_lines = [
        f"- {domain}.{svc}"
        for domain, svcs in services.items()
        if domain in CONTROL_DOMAINS
        for svc in svcs
    ]
    service_section = "\n".join(service_lines[:200])

    return (
        f"\n\n# 현재 HA 환경\n"
        f"## 엔티티 (도메인별):\n{entity_section}\n\n"
        f"## 제어 가능한 서비스:\n{service_section}"
    )


async def _handle_auto_generate(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
    client: Any,
    language: str,
    ai_model: str,
) -> None:
    """Auto 스코프: Skills + Graph를 한 번에 생성한다."""
    import json
    import yaml as pyyaml

    context = msg.get("context", {})
    graph_id = context.get("graph_id", "")

    system_prompt = _build_auto_generate_prompt(language, graph_id)
    system_prompt += _build_ha_context_section(hass)

    history = msg.get("messages", [])[-10:]
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({
        "role": "user",
        "content": (
            f"요청: {msg['request']}\n\n"
            '반드시 이 JSON 구조로만 응답하세요:\n'
            '{"skills": [{"id": "...", "name": "...", "yaml": "..."}], '
            '"graph": {"yaml": "..."}, "explanation": "..."}'
        ),
    })

    try:
        response = await client.chat.completions.create(
            model=ai_model,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=8000,
            temperature=0.3,
        )
        parsed = json.loads(response.choices[0].message.content)

        # 스킬 YAML 검증
        raw_skills = parsed.get("skills", [])
        validated_skills = []
        for skill_item in raw_skills:
            skill_yaml = skill_item.get("yaml", "")
            try:
                pyyaml.safe_load(skill_yaml)
                validated_skills.append({
                    "id": skill_item.get("id", ""),
                    "name": skill_item.get("name", ""),
                    "yaml": skill_yaml,
                })
            except pyyaml.YAMLError as e:
                _LOGGER.warning("Auto generate: skill YAML 무효 (%s): %s", skill_item.get("id"), e)

        # 그래프 YAML 검증
        graph_data = parsed.get("graph", {})
        graph_yaml = graph_data.get("yaml", "")
        try:
            pyyaml.safe_load(graph_yaml)
        except pyyaml.YAMLError as yaml_err:
            connection.send_error(msg["id"], "invalid_yaml", f"그래프 YAML 오류: {yaml_err}")
            return

        connection.send_result(msg["id"], {
            "skills": validated_skills,
            "graph": {"yaml": graph_yaml},
            "explanation": parsed.get("explanation", ""),
        })

    except json.JSONDecodeError as err:
        connection.send_error(msg["id"], "parse_error", f"LLM 응답 파싱 실패: {err}")
    except Exception as err:
        _LOGGER.exception("Auto generate error")
        connection.send_error(msg["id"], "ai_error", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/run_skill_test",
    vol.Required("skill_id"): str,
    vol.Required("user_input"): str,
    vol.Optional("model"): str,
    vol.Optional("language", default="en"): str,
})
@websocket_api.async_response
async def ws_run_skill_test(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Run a skill in a temporary single-agent graph for testing."""
    import uuid
    from .graph_engine import GraphEngine, ExecutionEvent
    from .graph_state import GraphState
    from .graph_loader import GraphDefinition
    from .helpers import get_exposed_entities
    from .exceptions import GraphExecutionError
    from .const import DEFAULT_CHAT_MODEL

    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "no_config", "No Extended Graph Agents config entry found")
        return
    client = entries[0].runtime_data

    skill_id = msg["skill_id"]
    user_input = msg["user_input"]
    model = msg.get("model") or DEFAULT_CHAT_MODEL
    language = msg.get("language", "en")

    skill_loader = _get_skill_loader(hass)
    try:
        skill = await hass.async_add_executor_job(skill_loader.load_by_id, skill_id)
    except Exception as err:
        connection.send_error(msg["id"], "skill_not_found", str(err))
        return

    temp_graph_data = {
        "id": f"__skill_test_{skill_id}",
        "name": f"Skill Test: {skill.name}",
        "model": model,
        "nodes": [
            {"id": "input", "type": "input", "name": "Input"},
            {
                "id": "agent",
                "type": "regular",
                "name": skill.name,
                "prompt": "You are a helpful assistant. Use the available tools to help the user.\n\nUser request: {{ user_input }}",
                "skills": [skill_id],
            },
            {"id": "output", "type": "output", "name": "Output"},
        ],
        "edges": [
            {"source": "input", "target": "agent"},
            {"source": "agent", "target": "output"},
        ],
    }

    try:
        graph = GraphDefinition(temp_graph_data)
    except InvalidGraph as err:
        connection.send_error(msg["id"], "invalid_graph", str(err))
        return

    trace: list[dict] = []

    def on_event(event: ExecutionEvent) -> None:
        trace.append({"type": event.event_type, **event.data})

    state = GraphState(
        user_input=user_input,
        conversation_id=str(uuid.uuid4()),
        language=language,
    )

    exposed_entities = get_exposed_entities(hass)

    try:
        engine = GraphEngine(
            hass=hass,
            client=client,
            default_model=model,
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

    total_tokens = _aggregate_token_usage(trace)
    connection.send_result(msg["id"], {
        "trace": trace,
        "output": output,
        "error": None,
        **total_tokens,
    })


def _aggregate_token_usage(trace: list[dict]) -> dict[str, Any]:
    """Aggregate token usage from trace events."""
    prompt = 0
    completion = 0
    for event in trace:
        usage = event.get("token_usage")
        if usage:
            prompt += usage.get("prompt_tokens", 0)
            completion += usage.get("completion_tokens", 0)
    if not prompt and not completion:
        return {}
    total = prompt + completion
    return {
        "total_tokens": {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": total},
    }


def _build_auto_generate_prompt(language: str, graph_id: str = "") -> str:
    """Auto 스코프: Skills + Graph 동시 생성용 시스템 프롬프트."""
    id_instruction = (
        f"그래프 id는 반드시 '{graph_id}'로 설정하세요." if graph_id
        else "그래프 id는 요청 내용을 반영한 영문 snake_case로 생성하세요 (예: smart_home_assistant)."
    )
    return (
        f"당신은 Home Assistant Graph Agent 전문가입니다.\n"
        f"사용자의 요청을 분석하고, 필요한 Skills와 실행 Graph를 함께 생성합니다.\n"
        f"모든 텍스트(name, description, prompt 등)는 언어코드 '{language}'에 해당하는 언어로 작성하세요.\n\n"

        "# 작업 순서\n"
        "1. 사용자 요청에서 필요한 HA 기능(제어·조회·알림 등)을 파악한다\n"
        "2. HA 환경의 엔티티·서비스를 확인해 실제 사용 가능한 것을 선택한다\n"
        "3. 기능별로 Skill을 설계한다 (너무 세분화하지 말고 의미 있는 단위로 묶을 것)\n"
        "4. Skill ID를 확정하고, 그 스킬을 활용하는 Graph를 설계한다\n\n"

        "# Skill 작성 규칙\n"
        "- id: 영문 snake_case, 고유하게 작성 (예: light_control, climate_control)\n"
        "- spec.description: LLM이 언제/어떻게 이 함수를 쓸지 명확히 설명\n"
        "- 파라미터 entity_id: description에 실제 엔티티 ID 예시 포함\n"
        "- native 타입: service에 HA 서비스명, data에 Jinja2로 파라미터 바인딩\n"
        "  예) data: {entity_id: \"{{ entity_id }}\", brightness_pct: \"{{ brightness_pct | default(100) }}\"}\n"
        "- template 타입: value_template에 Jinja2로 상태 조회\n"
        "  예) value_template: \"{{ states(entity_id) }} {{ state_attr(entity_id, 'unit_of_measurement') or '' }}\"\n\n"

        "# Graph 작성 규칙\n"
        f"- {id_instruction}\n"
        "- 의도가 여러 개면 router로 분류 후 각 전문 regular 노드로 라우팅\n"
        "- regular 노드의 skills에 위에서 생성한 skill id를 정확히 기재\n"
        "- condition 없는 엣지는 fallback으로 동작\n"
        "- system_prompt_prefix로 공통 페르소나/언어 지시 설정\n"
        "- 노드 prompt는 역할과 제약을 구체적으로 작성, {{ user_input }} 반드시 포함\n\n"

        "# Graph YAML 엣지 condition 문법\n"
        "edges:\n"
        "  - source: router_node\n"
        "    target: agent_a\n"
        "    condition: {variable: intent, value: lighting}  # router의 output_key 이름 사용\n"
        "  - source: router_node\n"
        "    target: fallback_agent  # condition 없음 = 아무것도 매칭 안 될 때 실행\n\n"

        "# 출력 형식 (반드시 이 JSON 구조만 사용)\n"
        '{"skills": [{"id": "...", "name": "...", "yaml": "전체 스킬 YAML"}], '
        '"graph": {"yaml": "전체 그래프 YAML"}, '
        '"explanation": "생성 내용 요약"}\n'
    )


def _build_ai_assist_prompt(scope: str, context: dict[str, Any], language: str = "en") -> str:
    """스코프별 시스템 프롬프트를 생성한다."""

    lang_instruction = (
        f"YAML 내의 모든 텍스트(name, description, prompt, output_template, function description 등)는 "
        f"반드시 언어코드 '{language}'에 해당하는 언어로 작성하세요. "
        f"(예: 'ko'이면 한국어, 'en'이면 영어)\n"
    )

    base = (
        "당신은 Home Assistant Graph Agent 전문가입니다. "
        "유저의 요청을 분석해 올바른 YAML을 생성하거나 수정합니다. "
        "반드시 JSON 형식 {\"yaml\": \"...\", \"explanation\": \"...\"} 으로만 응답하세요. "
        "explanation은 유저 요청과 동일한 언어로 작성하세요.\n"
        + lang_instruction + "\n"
    )

    if scope == "graph":
        graph_id = context.get("graph_id", "")
        return base + f"""# 설계 원칙

## 노드 타입 선택 기준
- **router**: LLM이 의도/도메인을 판단해 분기 (예: 조명 제어 vs 일반 질문)
- **condition**: 센서 상태·시간 등 Jinja2로 결정 가능한 규칙 기반 분기 (LLM 미사용, 빠름)
- **regular**: LLM이 실제 작업 수행 (답변 생성, 분석, HA 서비스 호출 등)
- **merge**: 병렬 브랜치 결과를 하나로 합치기 (LLM 미사용)

## Jinja2 컨텍스트 변수
- `{{{{ user_input }}}}` — 사용자 입력 (모든 노드에서 사용 가능)
- `{{{{ node_outputs['node_id'] }}}}` — 이전 노드의 출력 텍스트
- `{{{{ variables['output_key'] }}}}` — router/condition 노드가 저장한 분기 결과값
- `{{{{ is_state('entity_id', 'on') }}}}` — HA 엔티티 상태 확인
- `{{{{ states('sensor.x') | float }}}}` — HA 센서 값

## 엣지 동작 규칙
- `condition` 없는 엣지 = 항상 실행 (단순 연결 또는 router fallback)
- `condition`이 있는 엣지 = 해당 변수 값이 일치할 때만 실행
- 조건 엣지가 하나도 매칭 안 되면 → 조건 없는 엣지(fallback)로 실행
- `mode: parallel` 엣지들은 동시에 실행됨

---

# YAML 스키마

```yaml
id: string              # 그래프 고유 ID (기존이면 반드시 보존)
name: string
description: string
model: string           # 기본 모델 (예: gpt-5.4)
model_params:           # 선택사항
  temperature: 0.0~2.0
  max_tokens: integer
  reasoning_effort: low|medium|high
system_prompt_prefix: string  # 모든 노드 공통 prefix
nodes:
  - id: string          # 영문 snake_case
    type: input|router|regular|output|condition|merge
    name: string
edges:
  - source: node_id
    target: node_id
    mode: sequential|parallel  # 기본 sequential
    condition:           # router/condition 분기 엣지에만 사용
      variable: string   # router의 output_key 값
      value: string      # 이 값과 일치할 때만 실행
```

# 노드별 추가 필드

**router**: prompt(Jinja2), output_key(변수명), values(선택지 목록)
**regular**: prompt(Jinja2), skills(스킬 ID 목록), output_schema(구조화 출력), model(선택)
**output**: output_template(Jinja2, 선택사항)
**condition**: output_key(변수명), conditions(when/value 목록), default(기본값)
**merge**: merge_strategy(concat|template|last), separator, merge_template(Jinja2)

---

# 예제 1: 의도 분류 + 전문 에이전트 (가장 일반적인 패턴)

```yaml
id: GRAPH_ID_HERE
name: 스마트홈 어시스턴트
description: 의도를 분류하고 전문 에이전트로 라우팅합니다
model: gpt-5.4
system_prompt_prefix: "당신은 스마트홈 어시스턴트입니다. 항상 간결하게 답변하세요."
nodes:
  - id: input
    type: input
    name: 입력
  - id: intent_router
    type: router
    name: 의도 분류기
    prompt: |
      사용자 요청을 카테고리로 분류하세요.
      - lighting: 조명 켜기/끄기/밝기 조절
      - climate: 에어컨/난방 제어, 온도 설정
      - general: 그 외 모든 요청
      요청: {{{{ user_input }}}}
    output_key: intent
    values:
      - lighting
      - climate
      - general
  - id: lighting_agent
    type: regular
    name: 조명 에이전트
    prompt: |
      조명을 제어하거나 상태를 알려주세요.
      요청: {{{{ user_input }}}}
    skills:
      - light_control
  - id: climate_agent
    type: regular
    name: 냉난방 에이전트
    prompt: |
      냉난방 기기를 제어하거나 온도를 알려주세요.
      요청: {{{{ user_input }}}}
    skills:
      - climate_control
  - id: general_agent
    type: regular
    name: 일반 어시스턴트
    prompt: |
      스마트홈 관련 질문에 답변하세요.
      요청: {{{{ user_input }}}}
  - id: output
    type: output
    name: 출력
edges:
  - source: input
    target: intent_router
  - source: intent_router
    target: lighting_agent
    condition: {{variable: intent, value: lighting}}
  - source: intent_router
    target: climate_agent
    condition: {{variable: intent, value: climate}}
  - source: intent_router
    target: general_agent   # 조건 없음 = fallback (lighting/climate 아닐 때)
  - source: lighting_agent
    target: output
  - source: climate_agent
    target: output
  - source: general_agent
    target: output
```

# 예제 2: 병렬 분석 + merge

```yaml
id: GRAPH_ID_HERE
name: 다각도 분석 어시스턴트
description: 여러 관점에서 동시에 분석하고 종합합니다
model: gpt-5.4
nodes:
  - id: input
    type: input
    name: 입력
  - id: pros_analyst
    type: regular
    name: 장점 분석가
    prompt: |
      다음 주제의 장점과 기회를 분석하세요.
      주제: {{{{ user_input }}}}
  - id: cons_analyst
    type: regular
    name: 단점 분석가
    prompt: |
      다음 주제의 단점과 위험 요소를 분석하세요.
      주제: {{{{ user_input }}}}
  - id: merge_node
    type: merge
    name: 결과 종합
    merge_strategy: template
    merge_template: |
      ## 장점
      {{{{ node_outputs['pros_analyst'] }}}}

      ## 단점
      {{{{ node_outputs['cons_analyst'] }}}}
  - id: output
    type: output
    name: 출력
edges:
  - source: input
    target: pros_analyst
    mode: parallel
  - source: input
    target: cons_analyst
    mode: parallel
  - source: pros_analyst
    target: merge_node
  - source: cons_analyst
    target: merge_node
  - source: merge_node
    target: output
```

# 예제 3: HA 상태 기반 분기 (condition)

```yaml
id: GRAPH_ID_HERE
name: 상황별 스마트홈 에이전트
description: 현재 HA 상태(시간대/외출 여부)에 따라 다르게 동작합니다
model: gpt-5.4
nodes:
  - id: input
    type: input
    name: 입력
  - id: mode_check
    type: condition
    name: 모드 확인
    output_key: mode
    conditions:
      - when: "{{{{ is_state('input_boolean.away_mode', 'on') }}}}"
        value: away
      - when: "{{{{ now().hour >= 23 or now().hour < 7 }}}}"
        value: night
    default: home
  - id: away_agent
    type: regular
    name: 외출 모드 에이전트
    prompt: |
      외출 모드입니다. 보안·에너지 절약 중심으로 답변하세요.
      요청: {{{{ user_input }}}}
  - id: night_agent
    type: regular
    name: 야간 모드 에이전트
    prompt: |
      야간 시간입니다. 수면을 방해하지 않도록 조용한 제안을 해주세요.
      요청: {{{{ user_input }}}}
  - id: home_agent
    type: regular
    name: 일반 모드 에이전트
    prompt: |
      스마트홈 요청을 처리해주세요.
      요청: {{{{ user_input }}}}
  - id: output
    type: output
    name: 출력
edges:
  - source: input
    target: mode_check
  - source: mode_check
    target: away_agent
    condition: {{variable: mode, value: away}}
  - source: mode_check
    target: night_agent
    condition: {{variable: mode, value: night}}
  - source: mode_check
    target: home_agent
    condition: {{variable: mode, value: home}}
  - source: away_agent
    target: output
  - source: night_agent
    target: output
  - source: home_agent
    target: output
```

현재 그래프 ID: {graph_id}
전체 그래프 YAML을 반환하세요. id 필드는 반드시 보존하세요."""

    if scope == "node":
        node_type = context.get("node_type", "regular")
        node_id = context.get("node_id", "")
        node_name = context.get("node_name", "")
        return base + f"""# Node YAML 수정

대상 노드: id={node_id}, type={node_type}, name={node_name}

**규칙:** id와 type 필드는 절대 변경하지 마세요. 노드 단독 YAML만 반환하세요.

**Jinja2 컨텍스트 변수:**
- `{{{{ user_input }}}}` — 사용자 입력
- `{{{{ node_outputs['node_id'] }}}}` — 다른 노드의 출력
- `{{{{ variables['output_key'] }}}}` — router/condition 노드의 분기 결과

---

# 노드 타입별 예제

**router 노드 예제:**
```yaml
id: {node_id if node_type == "router" else "intent_router"}
type: router
name: 의도 분류기
prompt: |
  사용자 요청의 카테고리를 분류하세요.
  - smart_home: 기기 제어 (조명, 에어컨, 스위치 등)
  - query: 상태 조회, 정보 질문
  - automation: 자동화 규칙 설정
  요청: {{{{ user_input }}}}
output_key: intent
values:
  - smart_home
  - query
  - automation
```

**regular 노드 예제:**
```yaml
id: {node_id if node_type == "regular" else "assistant_agent"}
type: regular
name: 어시스턴트
prompt: |
  당신은 스마트홈 전문가입니다.
  분류 결과: {{{{ variables['intent'] }}}}
  요청: {{{{ user_input }}}}
  이전 분석: {{{{ node_outputs.get('analyzer', '') }}}}
skills:
  - light_control
  - climate_control
output_schema:
  - key: action
    type: string
    description: 수행한 작업 설명
  - key: success
    type: boolean
    description: 처리 성공 여부
```

**condition 노드 예제:**
```yaml
id: {node_id if node_type == "condition" else "time_check"}
type: condition
name: 시간대 확인
output_key: time_period
conditions:
  - when: "{{{{ now().hour >= 6 and now().hour < 12 }}}}"
    value: morning
  - when: "{{{{ now().hour >= 18 and now().hour < 22 }}}}"
    value: evening
  - when: "{{{{ is_state('input_boolean.away_mode', 'on') }}}}"
    value: away
default: daytime
```

**merge 노드 예제:**
```yaml
id: {node_id if node_type == "merge" else "result_merger"}
type: merge
name: 결과 종합
merge_strategy: template
merge_template: |
  ## 분석 결과 종합

  ### 주요 내용
  {{{{ node_outputs['main_agent'] }}}}

  ### 보조 분석
  {{{{ node_outputs['sub_agent'] }}}}
```

**output 노드 예제:**
```yaml
id: {node_id if node_type == "output" else "output"}
type: output
name: 출력
output_template: |
  처리 결과: {{{{ node_outputs['last_agent'] }}}}
```

노드 YAML만 반환하세요."""

    if scope == "skill":
        skill_id = context.get("skill_id", "")
        skill_name = context.get("skill_name", "")
        return base + f"""# Skill YAML

스킬은 regular 노드가 LLM 도구(tool)로 호출하는 함수 집합입니다.

**설계 원칙:**
- `spec.description`: LLM이 언제·어떻게 쓸지 명확히 기술
- 파라미터: LLM이 자연어에서 추론할 수 있는 수준으로 정의
- `native`: HA 서비스 직접 호출 (조명·스위치·알림 등)
- `template`: HA 상태 조회 및 연산
- `web`: 외부 API 호출

---

# 예제 1: native — HA 서비스 호출 (조명 제어)

```yaml
id: light_control
name: 조명 제어
group: home_control
description: 조명 켜기/끄기/밝기 조절
functions:
  - spec:
      name: turn_on_light
      description: 지정한 조명을 켭니다. 밝기를 선택적으로 설정할 수 있습니다.
      parameters:
        type: object
        properties:
          entity_id:
            type: string
            description: 조명 엔티티 ID (예: light.living_room, light.bedroom)
          brightness_pct:
            type: integer
            description: 밝기 퍼센트 (0-100). 생략하면 100%
        required:
          - entity_id
    function:
      type: native
      service: light.turn_on
      data:
        entity_id: "{{{{ entity_id }}}}"
        brightness_pct: "{{{{ brightness_pct | default(100) }}}}"
  - spec:
      name: turn_off_light
      description: 지정한 조명을 끕니다.
      parameters:
        type: object
        properties:
          entity_id:
            type: string
            description: 조명 엔티티 ID
        required:
          - entity_id
    function:
      type: native
      service: light.turn_off
      data:
        entity_id: "{{{{ entity_id }}}}"
```

# 예제 2: template — HA 상태 조회

```yaml
id: sensor_query
name: 센서 조회
group: home_monitor
description: HA 센서의 현재 상태 조회
functions:
  - spec:
      name: get_sensor_state
      description: 특정 센서의 현재 값을 조회합니다. 온도·습도·전력 등 모든 센서에 사용 가능합니다.
      parameters:
        type: object
        properties:
          entity_id:
            type: string
            description: 조회할 센서 엔티티 ID (예: sensor.living_room_temperature)
        required:
          - entity_id
    function:
      type: template
      value_template: "{{{{ states(entity_id) }}}} {{{{ state_attr(entity_id, 'unit_of_measurement') or '' }}}}"
  - spec:
      name: get_entity_state
      description: 임의의 HA 엔티티 상태와 주요 속성을 조회합니다.
      parameters:
        type: object
        properties:
          entity_id:
            type: string
            description: 엔티티 ID (예: light.living_room, switch.fan, climate.ac)
        required:
          - entity_id
    function:
      type: template
      value_template: >
        {{{{ entity_id }}}}: state={{{{ states(entity_id) }}}},
        friendly_name={{{{ state_attr(entity_id, 'friendly_name') }}}}
```

# 예제 3: web — 외부 API 호출

```yaml
id: weather_api
name: 날씨 조회
group: external
description: 외부 날씨 API에서 현재 날씨 정보를 가져옵니다
functions:
  - spec:
      name: get_weather
      description: 특정 도시의 현재 날씨 정보를 조회합니다.
      parameters:
        type: object
        properties:
          city:
            type: string
            description: 도시 이름 (예: Seoul, Busan)
        required:
          - city
    function:
      type: web
      url: "https://wttr.in/{{{{ city }}}}?format=j1"
      method: GET
      headers:
        Accept: application/json
```

현재 스킬: id={skill_id}, name={skill_name}
전체 스킬 YAML을 반환하세요. id 필드는 반드시 보존하세요."""

    return base


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/run_graph",
    vol.Optional("graph_id"): str,
    vol.Optional("graph"): dict,
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
        if "graph" in msg and msg["graph"]:
            # 프론트에서 현재 UI 상태의 그래프 정의를 직접 받은 경우 (미저장 변경사항 포함)
            graph = GraphDefinition(msg["graph"])
        elif "graph_id" in msg and msg["graph_id"]:
            graph = await hass.async_add_executor_job(loader.load_by_id, msg["graph_id"])
        else:
            connection.send_error(msg["id"], "missing_param", "Either 'graph' or 'graph_id' is required")
            return
    except GraphNotFound as err:
        connection.send_error(msg["id"], "graph_not_found", str(err))
        return
    except InvalidGraph as err:
        connection.send_error(msg["id"], "invalid_graph", str(err))
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

    total_tokens = _aggregate_token_usage(trace)
    connection.send_result(msg["id"], {
        "trace": trace,
        "output": output,
        "error": None,
        **total_tokens,
    })
