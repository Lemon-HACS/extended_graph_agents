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
    vol.Required("scope"): vol.In(["graph", "node", "skill"]),
    vol.Required("request"): str,
    vol.Required("current_yaml"): str,
    vol.Optional("messages", default=[]): list,
    vol.Optional("context", default={}): dict,
    vol.Optional("language", default="en"): str,
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
    from .const import DEFAULT_CHAT_MODEL

    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "no_config", "No Extended Graph Agents config entry found")
        return
    client = entries[0].runtime_data

    scope = msg["scope"]
    context = msg.get("context", {})
    system_prompt = _build_ai_assist_prompt(scope, context)

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
            model=DEFAULT_CHAT_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=4000,
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

    connection.send_result(msg["id"], {
        "trace": trace,
        "output": output,
        "error": None,
    })


def _build_ai_assist_prompt(scope: str, context: dict[str, Any]) -> str:
    """스코프별 시스템 프롬프트를 생성한다."""

    base = (
        "당신은 Home Assistant Graph Agent 전문가입니다. "
        "유저의 요청을 분석해 올바른 YAML을 생성하거나 수정합니다. "
        "반드시 JSON 형식 {\"yaml\": \"...\", \"explanation\": \"...\"} 으로만 응답하세요. "
        "explanation은 한국어로 작성하세요.\n\n"
    )

    if scope == "graph":
        node_id = context.get("graph_id", "")
        return base + f"""# Graph YAML 스키마

```yaml
id: string              # 그래프 고유 ID (변경 금지)
name: string
description: string
model: string           # 기본 LLM 모델 (예: gpt-4o, gpt-4o-mini)
model_params:           # 선택사항
  temperature: 0.0~2.0
  top_p: 0.0~1.0
  max_tokens: integer
  reasoning_effort: low|medium|high
system_prompt_prefix: string   # 모든 노드 공통 prefix
max_tool_iterations: integer   # 기본 10
nodes:
  - id: string
    type: input|router|regular|output
    name: string
    # 노드별 추가 필드 (아래 참조)
edges:
  - source: node_id
    target: node_id
    mode: sequential|parallel   # 기본 sequential
    condition:                  # 선택사항 (router 노드 출력 조건)
      variable: string          # router의 output_key 값
      value: string             # 매칭할 값
```

# 노드 타입별 필드

**input 노드**: 진입점. 추가 필드 없음.

**output 노드**:
```yaml
output_template: |    # 선택사항. Jinja2. {{ node_outputs['node_id'] }} 로 다른 노드 출력 참조
```

**router 노드**: LLM이 라우팅 결정을 내린다.
```yaml
prompt: |             # Jinja2 템플릿. {{ user_input }} 사용 가능
output_key: route     # 결과를 저장할 변수명
values:               # LLM이 선택 가능한 값 목록
  - value1
  - value2
```

**regular (agent) 노드**:
```yaml
prompt: |             # Jinja2. {{ user_input }}, {{ node_outputs['id'] }}, {{ variables['id.key'] }}
model: string         # 선택사항. 이 노드만 다른 모델 사용
skills:               # 재사용 가능한 스킬 ID 목록 (functions 대신 skills를 사용하세요)
  - skill_id
output_schema:        # 선택사항. JSON 구조화 출력
  - key: field_name
    type: string|number|integer|boolean
    description: 설명
```

현재 그래프 ID: {node_id}
전체 그래프 YAML을 반환하세요. id 필드는 반드시 보존하세요."""

    if scope == "node":
        node_type = context.get("node_type", "regular")
        node_id = context.get("node_id", "")
        node_name = context.get("node_name", "")
        return base + f"""# Node YAML 수정

대상 노드: id={node_id}, type={node_type}, name={node_name}

**규칙:**
- id와 type 필드는 절대 변경하지 마세요.
- 노드 단독 YAML만 반환하세요 (전체 그래프 아님).
- Jinja2 템플릿: {{ user_input }}, {{ node_outputs['node_id'] }}, {{ variables['node_id.key'] }}

# 노드 타입별 필드

**router**: output_key(변수명), values(선택지 목록), prompt(Jinja2)
**regular**: prompt(Jinja2), skills(ID 목록), output_schema(구조화 출력), model(선택사항)
**output**: output_template(Jinja2, 선택사항)
**input**: 추가 필드 없음

스킬은 Skills 탭에서 관리하며, 노드에는 skill ID 목록만 지정합니다.

노드 YAML만 반환하세요."""

    if scope == "skill":
        skill_id = context.get("skill_id", "")
        skill_name = context.get("skill_name", "")
        return base + f"""# Skill YAML 스키마

스킬은 AI 에이전트 노드가 재사용할 수 있는 함수 집합입니다.

```yaml
id: string        # 스킬 고유 ID (변경 금지 - 기존 스킬인 경우)
name: string
group: string     # 선택사항. 그룹핑용
description: string
functions:
  - spec:
      name: function_name
      description: LLM에게 제공할 함수 설명
      parameters:
        type: object
        properties:
          param_name:
            type: string|integer|number|boolean
            description: 파라미터 설명
            enum: [선택1, 선택2]   # 선택사항
        required: [필수파라미터명]
    function:
      type: native|template|web
      # native   → service: "domain.service", data: {{param: "{{{{ param }}}}"}}
      # template → value_template: "{{{{ states('sensor.x') }}}}"
      # web      → url: "...", method: GET|POST, headers: {{}}
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

    connection.send_result(msg["id"], {
        "trace": trace,
        "output": output,
        "error": None,
    })
