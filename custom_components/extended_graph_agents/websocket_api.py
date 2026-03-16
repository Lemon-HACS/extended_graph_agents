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
    system_prompt = _build_ai_assist_prompt(scope, context, language)

    # HA 컨텍스트 포함
    if msg.get("include_ha_context", False):
        states = hass.states.async_all()
        entity_summary = "\n".join(
            f"- {s.entity_id} ({s.attributes.get('friendly_name', '')})"
            for s in states[:200]
        )
        services = hass.services.async_services()
        service_list = "\n".join(
            f"- {domain}.{svc}"
            for domain, svcs in services.items()
            for svc in svcs
        )[:3000]

        system_prompt += (
            f"\n\n# 현재 HA 환경\n"
            f"## 엔티티 ({len(states)}개, 일부):\n{entity_summary}\n"
            f"## 서비스:\n{service_list}"
        )

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
        ai_model = msg.get("model") or DEFAULT_AI_ASSIST_MODEL
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


def _build_ai_assist_prompt(scope: str, context: dict[str, Any], language: str = "en") -> str:
    """스코프별 시스템 프롬프트를 생성한다."""

    # 언어에 따른 텍스트 작성 지시
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
        return base + f"""# 그래프 설계 원칙 (반드시 준수)

## 단계적 설계 방법
YAML을 바로 작성하지 말고, 다음 순서로 설계하세요:
1. 워크플로우의 목적과 입력/출력을 파악한다
2. 필요한 분기(조건/라우팅)가 있는지 확인한다
3. 병렬 처리가 필요한 작업이 있는지 확인한다
4. 각 노드의 역할을 명확히 나눈다
5. 노드 간 데이터 흐름을 설계한다

## 노드 타입 선택 기준
- **router**: LLM이 상황을 판단해 분기해야 할 때 (의도 분류, 도메인 분류 등)
- **condition**: 센서 상태, 숫자 비교 등 Jinja2로 결정 가능한 규칙 기반 분기
- **regular**: LLM이 실제 작업을 수행할 때 (답변 생성, 분석, 요약, HA 서비스 호출 등)
- **merge**: 병렬 브랜치 결과를 하나로 합칠 때

## 고품질 프롬프트 작성 규칙
- 노드 prompt는 구체적이고 명확하게 작성 (역할, 제약, 출력 형식 명시)
- `{{ user_input }}`을 반드시 포함
- 이전 노드 결과는 `{{ node_outputs['노드id'] }}`로 참조
- router/condition 분기 후 각 브랜치 노드의 프롬프트는 해당 케이스에 특화되게 작성
- system_prompt_prefix로 공통 페르소나/지시사항을 정의하면 중복을 줄일 수 있음

## 자주 쓰는 패턴
**단순 에이전트**: input → regular → output
**의도 분류 후 전문화**: input → router → [전문_에이전트A, 전문_에이전트B] → output
**병렬 처리 후 합치기**: input → [에이전트A, 에이전트B] (parallel edges) → merge → output
**HA 상태 기반 분기**: input → condition → [케이스A, 케이스B] → output

---

# Graph YAML 스키마

```yaml
id: string              # 그래프 고유 ID (기존 그래프라면 반드시 보존)
name: string            # 그래프 이름
description: string     # 그래프 설명
model: string           # 기본 LLM 모델
model_params:           # 선택사항 - 그래프 전체 기본값
  temperature: 0.0~2.0
  top_p: 0.0~1.0
  max_tokens: integer
  reasoning_effort: low|medium|high
system_prompt_prefix: string   # 모든 노드 공통 prefix (페르소나, 공통 지시사항)
max_tool_iterations: integer   # 기본 10
nodes:
  - id: string          # 영문 snake_case (예: intent_router, lighting_agent)
    type: input|router|regular|output|condition|merge
    name: string
    # 노드별 추가 필드 (아래 참조)
edges:
  - source: node_id
    target: node_id
    mode: sequential|parallel   # 기본 sequential. 병렬 실행 시 parallel
    condition:                  # router/condition 분기 엣지에만 사용
      variable: string          # router의 output_key 값
      value: string             # 매칭할 값 (해당 값일 때만 이 엣지 사용)
```

# 노드 타입별 필드

**input 노드**: 진입점. 추가 필드 없음.

**output 노드**:
```yaml
output_template: |    # 선택사항. Jinja2.
  최종 답변: {{ node_outputs['last_agent'] }}
```

**router 노드**: LLM이 라우팅 결정.
```yaml
prompt: |
  사용자의 요청을 분석해 적절한 카테고리를 선택하세요.
  요청: {{ user_input }}
output_key: route          # 결과 저장 변수명
values:
  - category_a
  - category_b
  - fallback
```

**regular (agent) 노드**:
```yaml
prompt: |
  당신은 [역할]입니다. [구체적 지시사항]
  사용자 요청: {{ user_input }}
  # 이전 노드 결과 참조 예시:
  # 분류 결과: {{ variables['router_node.route'] }}
  # 이전 답변: {{ node_outputs['prev_agent'] }}
model: string         # 선택사항. 이 노드만 다른 모델 사용
skills:               # 스킬 ID 목록 (HA 서비스 호출 등)
  - skill_id
output_schema:        # 선택사항. JSON 구조화 출력 시 사용
  - key: field_name
    type: string|number|integer|boolean
    description: 필드 설명
```

**condition 노드**: Jinja2로 분기 (LLM 없음, 빠름)
```yaml
output_key: status
conditions:
  - when: "{{{{ is_state('light.living_room', 'on') }}}}"
    value: "on"
  - when: "{{{{ states('sensor.temperature') | float > 25 }}}}"
    value: "hot"
default: "normal"
```

**merge 노드**: 병렬 브랜치 합치기 (LLM 없음)
```yaml
merge_strategy: concat|template|last
separator: "\\n\\n---\\n\\n"
merge_template: |       # template 전략일 때
  ## 결과 A
  {{{{ node_outputs['agent_a'] }}}}
  ## 결과 B
  {{{{ node_outputs['agent_b'] }}}}
```

현재 그래프 ID: {graph_id}
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

**Jinja2 컨텍스트 변수:**
- `{{ user_input }}` — 사용자 입력
- `{{ node_outputs['node_id'] }}` — 다른 노드의 출력
- `{{ variables['node_id.output_key'] }}` — router/condition 노드의 분기 결과

**노드 타입별 핵심 필드:**
- **router**: output_key(변수명), values(선택지 목록), prompt(역할과 선택지 설명 포함)
- **regular**: prompt(구체적 역할/지시), skills(ID 목록), output_schema(구조화 출력), model(선택)
- **output**: output_template(최종 출력 포맷, Jinja2)
- **input**: 추가 필드 없음
- **condition**: output_key(변수명), conditions(when/value 목록), default(기본값)
- **merge**: merge_strategy(concat|template|last), separator, merge_template

노드 YAML만 반환하세요."""

    if scope == "skill":
        skill_id = context.get("skill_id", "")
        skill_name = context.get("skill_name", "")
        return base + f"""# Skill YAML 스키마

스킬은 AI 에이전트 노드가 도구(tool)로 호출할 수 있는 함수 집합입니다.

**설계 원칙:**
- spec.description은 LLM이 언제 이 함수를 써야 하는지 명확히 설명
- 파라미터는 LLM이 추론할 수 있는 수준으로 정의
- native 타입: HA 서비스 직접 호출 (조명, 스위치, 알림 등)
- template 타입: HA 상태 조회 및 간단한 연산
- web 타입: 외부 API 호출

```yaml
id: string        # 스킬 고유 ID (기존이면 반드시 보존)
name: string
group: string     # 선택사항. 그룹핑
description: string
functions:
  - spec:
      name: function_name   # 영문 snake_case
      description: "LLM에게 제공할 함수 설명 - 언제 어떻게 쓰는지 명확히"
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
      # web      → url: "https://...", method: GET|POST, headers: {{}}
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
