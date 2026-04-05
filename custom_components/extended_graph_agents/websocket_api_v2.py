"""WebSocket API v2 — 새 그래프 포맷 + dry-run + 대화형 AI 지원.

기존 API와 병행하여 등록됩니다 (v2/ prefix).
스킬 관련 API는 제거됨.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any

import voluptuous as vol
import yaml as pyyaml

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN, EVENT_GRAPH_SAVED, EVENT_GRAPH_DELETED
from .graph_v2 import GraphV2, GraphLoaderV2
from .engine_v2 import EngineV2, ExecutionEvent
from .graph_state import GraphState
from .exceptions import GraphNotFound, InvalidGraph

_LOGGER = logging.getLogger(__name__)

PREFIX = f"{DOMAIN}/v2"


@callback
def async_setup_websocket_api_v2(hass: HomeAssistant) -> None:
    """Register v2 WebSocket commands."""
    websocket_api.async_register_command(hass, ws_list_graphs_v2)
    websocket_api.async_register_command(hass, ws_get_graph_v2)
    websocket_api.async_register_command(hass, ws_save_graph_v2)
    websocket_api.async_register_command(hass, ws_delete_graph_v2)
    websocket_api.async_register_command(hass, ws_run_graph_v2)
    websocket_api.async_register_command(hass, ws_ai_generate_v2)


def _get_loader_v2(hass: HomeAssistant) -> GraphLoaderV2:
    from pathlib import Path
    from .const import GRAPHS_SUBDIR
    graphs_dir = Path(hass.config.config_dir) / GRAPHS_SUBDIR
    return GraphLoaderV2(str(graphs_dir))


def _get_client(hass: HomeAssistant):
    """Get the OpenAI client from config entry."""
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return None
    return entries[0].runtime_data


# ── Graph CRUD ──

@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{PREFIX}/list_graphs",
})
@websocket_api.async_response
async def ws_list_graphs_v2(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader_v2(hass)
    graphs = await hass.async_add_executor_job(loader.load_all)
    connection.send_result(msg["id"], [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "node_count": len(g.nodes),
        }
        for g in graphs
    ])


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{PREFIX}/get_graph",
    vol.Required("graph_id"): str,
})
@websocket_api.async_response
async def ws_get_graph_v2(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader_v2(hass)
    try:
        graph = await hass.async_add_executor_job(loader.load_by_id, msg["graph_id"])
        connection.send_result(msg["id"], graph.to_dict())
    except GraphNotFound as err:
        connection.send_error(msg["id"], "graph_not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{PREFIX}/save_graph",
    vol.Required("graph"): dict,
})
@websocket_api.async_response
async def ws_save_graph_v2(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader_v2(hass)
    try:
        graph = GraphV2(msg["graph"])
        await hass.async_add_executor_job(loader.save, graph)
        hass.bus.async_fire(EVENT_GRAPH_SAVED, {
            "graph_id": graph.id,
            "graph_name": graph.name,
        })
        connection.send_result(msg["id"], {"id": graph.id, "success": True})
    except InvalidGraph as err:
        connection.send_error(msg["id"], "invalid_graph", str(err))
    except Exception as err:
        connection.send_error(msg["id"], "save_failed", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{PREFIX}/delete_graph",
    vol.Required("graph_id"): str,
})
@websocket_api.async_response
async def ws_delete_graph_v2(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    loader = _get_loader_v2(hass)
    try:
        await hass.async_add_executor_job(loader.delete, msg["graph_id"])
        hass.bus.async_fire(EVENT_GRAPH_DELETED, {"graph_id": msg["graph_id"]})
        connection.send_result(msg["id"], {"success": True})
    except GraphNotFound as err:
        connection.send_error(msg["id"], "graph_not_found", str(err))


# ── Graph Execution ──

@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{PREFIX}/run_graph",
    vol.Optional("graph_id"): str,
    vol.Optional("graph"): dict,
    vol.Required("user_input"): str,
    vol.Optional("language", default="en"): str,
    vol.Optional("dry_run", default=False): bool,
})
@websocket_api.async_response
async def ws_run_graph_v2(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Run a v2 graph. dry_run=True blocks service calls."""
    from .helpers import get_exposed_entities
    from .const import DEFAULT_CHAT_MODEL

    client = _get_client(hass)
    if not client:
        connection.send_error(msg["id"], "no_config", "No config entry found")
        return

    loader = _get_loader_v2(hass)
    trace: list[dict] = []

    def on_event(event: ExecutionEvent) -> None:
        trace.append({"type": event.event_type, **event.data})

    try:
        if "graph" in msg and msg["graph"]:
            graph = GraphV2(msg["graph"])
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
        engine = EngineV2(
            hass=hass,
            client=client,
            default_model=graph.model or DEFAULT_CHAT_MODEL,
            event_callback=on_event,
            dry_run=msg.get("dry_run", False),
        )
        output = await engine.execute(graph, state, exposed_entities)
    except Exception as err:
        connection.send_result(msg["id"], {
            "trace": trace,
            "output": None,
            "error": str(err),
        })
        return

    total_tokens = _aggregate_token_usage(trace)
    connection.send_result(msg["id"], {
        "trace": trace,
        "output": output,
        "error": None,
        **total_tokens,
    })


# ── AI Generate (대화형 그래프 생성) ──

@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): f"{PREFIX}/ai_generate",
    vol.Required("request"): str,
    vol.Optional("current_graph"): dict,
    vol.Optional("messages", default=[]): list,
    vol.Optional("language", default="en"): str,
    vol.Optional("model"): str,
})
@websocket_api.async_response
async def ws_ai_generate_v2(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """대화형 그래프 생성 — 새 v2 포맷으로 직접 생성.

    스킬 없이 인라인 도구를 포함한 완전한 그래프를 한번에 생성합니다.
    """
    from .const import DEFAULT_AI_ASSIST_MODEL

    client = _get_client(hass)
    if not client:
        connection.send_error(msg["id"], "no_config", "No config entry found")
        return

    language = msg.get("language", "en")
    ai_model = msg.get("model") or DEFAULT_AI_ASSIST_MODEL

    system_prompt = _build_v2_generate_prompt(language)
    system_prompt += _build_ha_context_section(hass)

    history = msg.get("messages", [])[-10:]
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)

    # 기존 그래프가 있으면 수정 컨텍스트 제공
    current_graph = msg.get("current_graph")
    context_str = ""
    if current_graph:
        current_yaml = pyyaml.dump(current_graph, allow_unicode=True, default_flow_style=False)
        context_str = f"\n현재 그래프 (이를 기반으로 수정하세요):\n```yaml\n{current_yaml}\n```\n\n"

    messages.append({
        "role": "user",
        "content": (
            f"{context_str}"
            f"요청: {msg['request']}\n\n"
            '반드시 이 JSON 형식으로만 응답하세요:\n'
            '{"graph": {그래프 YAML을 JSON 객체로}, "explanation": "설명"}'
        ),
    })

    for attempt in range(2):
        try:
            response = await client.chat.completions.create(
                model=ai_model,
                messages=messages,
                response_format={"type": "json_object"},
                max_tokens=8000,
                temperature=0.3,
            )
            parsed = json.loads(response.choices[0].message.content)
            graph_data = parsed.get("graph", {})

            # 유효성 검증
            graph = GraphV2(graph_data)

            connection.send_result(msg["id"], {
                "graph": graph.to_dict(),
                "explanation": parsed.get("explanation", ""),
            })
            return

        except json.JSONDecodeError as err:
            if attempt == 0:
                _LOGGER.warning("AI generate v2: JSON 파싱 실패, 재시도: %s", err)
                continue
            connection.send_error(msg["id"], "parse_error", f"LLM 응답 파싱 실패: {err}")
        except InvalidGraph as err:
            if attempt == 0:
                _LOGGER.warning("AI generate v2: 유효하지 않은 그래프, 재시도: %s", err)
                continue
            connection.send_error(msg["id"], "invalid_graph", f"생성된 그래프가 유효하지 않습니다: {err}")
        except Exception as err:
            _LOGGER.exception("AI generate v2 error")
            connection.send_error(msg["id"], "ai_error", str(err))
            return


# ── Helper functions ──

def _aggregate_token_usage(trace: list[dict]) -> dict[str, Any]:
    prompt = completion = 0
    for event in trace:
        usage = event.get("token_usage")
        if usage:
            prompt += usage.get("prompt_tokens", 0)
            completion += usage.get("completion_tokens", 0)
    if not prompt and not completion:
        return {}
    return {
        "total_tokens": {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": prompt + completion,
        },
    }


def _build_ha_context_section(hass: HomeAssistant) -> str:
    """HA 엔티티·서비스 컨텍스트."""
    states = hass.states.async_all()

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
    ][:200]
    service_section = "\n".join(service_lines)

    return (
        f"\n\n# 현재 HA 환경\n"
        f"## 엔티티:\n{entity_section}\n\n"
        f"## 서비스:\n{service_section}"
    )


def _build_v2_generate_prompt(language: str) -> str:
    """v2 포맷 그래프 생성 시스템 프롬프트."""
    return f"""당신은 Home Assistant Graph Agent 전문가입니다.
사용자의 요청을 분석하고, v2 포맷의 그래프를 생성합니다.
모든 텍스트는 언어코드 '{language}'에 해당하는 언어로 작성하세요.

# v2 그래프 포맷

## 노드 타입 (3종류만)
- **router**: LLM이 의도를 분류하여 분기 (prompt, routes 필수)
- **agent**: LLM이 도구를 사용하여 작업 수행 (prompt 필수, tools 선택)
- **condition**: Jinja2 템플릿으로 결정적 분기 (conditions 필수, LLM 미사용)

## 엣지 구문
- `START -> node_name` : 시작점
- `node_name -> END` : 종료점
- `node_name -> other_node` : 단순 연결
- `node_name -> node_a, node_b` : 병렬 fan-out
- 조건부 라우팅 (dict 형태):
  ```yaml
  classify:
    smart_home: smart_home_agent
    general: fallback
  ```

## 인라인 도구 (스킬 대신 노드에 직접 정의)
```yaml
tools:
  - name: turn_on_light
    description: "조명 켜기"
    service: light.turn_on           # native HA 서비스
    params:
      entity_id: {{type: string, description: "엔티티 ID"}}
  - name: get_temperature
    description: "온도 조회"
    template: "{{{{ states('sensor.temp') }}}}"  # Jinja2 템플릿
  - name: search_web
    description: "웹 검색"
    url: "https://api.example.com/search?q={{{{query}}}}"  # HTTP 요청
```

## 도구 타입 결정
- `service` 필드 있으면 → native (HA 서비스 호출)
- `template` 필드 있으면 → template (상태 조회, 읽기전용)
- `url` 필드 있으면 → web (HTTP 요청)

# 설계 원칙
1. 의도가 여러 개면 router로 분류 → 전문 agent로 라우팅
2. HA 상태로 분기 가능하면 condition 사용 (LLM 호출 절약)
3. 도구의 params에 description을 상세히 작성 (LLM이 인자를 정확히 추출하도록)
4. entity_id description에 실제 사용 가능한 엔티티 예시를 포함
5. 모든 agent 노드의 prompt에 역할과 제약을 구체적으로 작성
6. **서비스와 엔티티 도메인을 반드시 일치시키세요!**
   - switch.* 엔티티 → switch.turn_on / switch.turn_off
   - light.* 엔티티 → light.turn_on / light.turn_off
   - climate.* 엔티티 → climate.set_temperature 등
   - 도메인이 섞일 수 있으면 homeassistant.turn_on / homeassistant.turn_off 사용 (모든 도메인에 작동)
7. 엔티티 목록을 보고 실제 존재하는 entity_id를 사용하세요. 추측하지 마세요.

# 출력 형식
반드시 JSON으로 응답:
{{"graph": {{그래프 정의 객체}}, "explanation": "설명"}}

graph 객체는 다음 필드를 포함:
- name, model, nodes (dict), edges (list)
- 선택: description, model_params, system_prompt_prefix

# 예제

```json
{{
  "graph": {{
    "name": "스마트홈 에이전트",
    "model": "gpt-5.4",
    "nodes": {{
      "classify": {{
        "type": "router",
        "prompt": "사용자 의도를 분류하세요: smart_home(기기 제어), general(일반 질문)",
        "routes": ["smart_home", "general"]
      }},
      "smart_home_agent": {{
        "type": "agent",
        "prompt": "스마트홈 기기를 제어하세요. 요청에 맞는 도구를 사용하세요.",
        "tools": [
          {{
            "name": "control_light",
            "description": "조명 켜기/끄기",
            "service": "light.turn_on",
            "params": {{"entity_id": {{"type": "string", "description": "조명 ID (예: light.living_room)"}}}}
          }},
          {{
            "name": "get_temp",
            "description": "온도 조회",
            "template": "{{{{{{ states('sensor.temperature') }}}}}}"
          }}
        ]
      }},
      "fallback": {{
        "type": "agent",
        "prompt": "친절하게 일반 대화를 처리하세요."
      }}
    }},
    "edges": [
      "START -> classify",
      {{"classify": {{"smart_home": "smart_home_agent", "general": "fallback"}}}},
      "smart_home_agent -> END",
      "fallback -> END"
    ]
  }},
  "explanation": "의도 분류 후 스마트홈 제어와 일반 대화로 라우팅하는 에이전트를 생성했습니다."
}}
```
"""
