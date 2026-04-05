"""엔진 v2 테스트 — mock LLM client로 그래프 실행 검증."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from custom_components.extended_graph_agents.graph_v2 import GraphV2, START, END
from custom_components.extended_graph_agents.graph_state import GraphState
from custom_components.extended_graph_agents.engine_v2 import EngineV2, NodeResult, ExecutionEvent


# ── Mock helpers ──

def make_llm_response(content: str, tool_calls=None):
    """Mock OpenAI chat completion response."""
    choice = MagicMock()
    choice.message.content = content
    choice.message.tool_calls = tool_calls
    resp = MagicMock()
    resp.choices = [choice]
    resp.usage.prompt_tokens = 50
    resp.usage.completion_tokens = 25
    return resp


def make_tool_call(call_id: str, name: str, arguments: dict):
    tc = MagicMock()
    tc.id = call_id
    tc.function.name = name
    tc.function.arguments = json.dumps(arguments)
    return tc


# ── Test data ──

SIMPLE_AGENT = {
    "name": "simple",
    "model": "gpt-4o",
    "nodes": {
        "chatbot": {
            "type": "agent",
            "prompt": "You are helpful",
        },
    },
    "edges": ["START -> chatbot", "chatbot -> END"],
}

ROUTER_GRAPH = {
    "name": "router test",
    "model": "gpt-4o",
    "nodes": {
        "classify": {
            "type": "router",
            "prompt": "Classify intent",
            "routes": ["greet", "help"],
        },
        "greeter": {
            "type": "agent",
            "prompt": "Say hello",
        },
        "helper": {
            "type": "agent",
            "prompt": "Help the user",
        },
    },
    "edges": [
        "START -> classify",
        {"classify": {"greet": "greeter", "help": "helper"}},
        "greeter -> END",
        "helper -> END",
    ],
}

TOOL_AGENT = {
    "name": "tool test",
    "model": "gpt-4o",
    "nodes": {
        "agent": {
            "type": "agent",
            "prompt": "Control smart home",
            "tools": [
                {
                    "name": "turn_on_light",
                    "description": "Turn on a light",
                    "service": "light.turn_on",
                    "params": {"entity_id": "string"},
                },
                {
                    "name": "get_temp",
                    "description": "Get temperature",
                    "template": "{{ states('sensor.temp') }}",
                },
            ],
        },
    },
    "edges": ["START -> agent", "agent -> END"],
}


# ── Tests ──

class TestSimpleExecution:

    @pytest.mark.asyncio
    async def test_single_agent(self):
        """단일 에이전트 노드 실행."""
        graph = GraphV2(SIMPLE_AGENT)
        client = AsyncMock()
        client.chat.completions.create.return_value = make_llm_response("안녕하세요!")

        engine = EngineV2(hass=MagicMock(), client=client, default_model="gpt-4o")
        state = GraphState(user_input="hello", conversation_id="test")

        result = await engine.execute(graph, state)
        assert result == "안녕하세요!"
        assert client.chat.completions.create.called

    @pytest.mark.asyncio
    async def test_execution_events(self):
        """실행 이벤트가 올바르게 발생하는지."""
        graph = GraphV2(SIMPLE_AGENT)
        client = AsyncMock()
        client.chat.completions.create.return_value = make_llm_response("hi")

        events = []
        engine = EngineV2(
            hass=MagicMock(), client=client,
            event_callback=lambda e: events.append(e),
        )
        state = GraphState(user_input="test", conversation_id="test")

        await engine.execute(graph, state)

        event_types = [e.event_type for e in events]
        assert "node_started" in event_types
        assert "node_finished" in event_types


class TestRouterExecution:

    @pytest.mark.asyncio
    async def test_router_routes_correctly(self):
        """라우터가 올바른 분기를 선택하는지."""
        graph = GraphV2(ROUTER_GRAPH)
        client = AsyncMock()

        # Router returns "greet"
        router_resp = make_llm_response(json.dumps({"route": "greet"}))
        agent_resp = make_llm_response("Hello there!")

        client.chat.completions.create.side_effect = [router_resp, agent_resp]

        engine = EngineV2(hass=MagicMock(), client=client)
        state = GraphState(user_input="hi", conversation_id="test")

        result = await engine.execute(graph, state)
        assert result == "Hello there!"
        # Router call + greeter call = 2
        assert client.chat.completions.create.call_count == 2

    @pytest.mark.asyncio
    async def test_router_other_branch(self):
        """라우터가 다른 분기를 선택하는지."""
        graph = GraphV2(ROUTER_GRAPH)
        client = AsyncMock()

        router_resp = make_llm_response(json.dumps({"route": "help"}))
        agent_resp = make_llm_response("How can I help?")

        client.chat.completions.create.side_effect = [router_resp, agent_resp]

        engine = EngineV2(hass=MagicMock(), client=client)
        state = GraphState(user_input="help me", conversation_id="test")

        result = await engine.execute(graph, state)
        assert result == "How can I help?"


class TestDryRun:

    @pytest.mark.asyncio
    async def test_dry_run_blocks_service_calls(self):
        """Dry-run에서 service call이 차단되는지."""
        graph = GraphV2(TOOL_AGENT)
        client = AsyncMock()
        hass = MagicMock()
        hass.services.async_call = AsyncMock()

        # First call: LLM requests tool use
        tool_call = make_tool_call("tc1", "turn_on_light", {"entity_id": "light.living"})
        first_resp = make_llm_response(None, tool_calls=[tool_call])
        # Second call: LLM gives final answer
        second_resp = make_llm_response("조명을 켰습니다!")

        client.chat.completions.create.side_effect = [first_resp, second_resp]

        engine = EngineV2(hass=hass, client=client, dry_run=True)
        state = GraphState(user_input="거실 조명 켜줘", conversation_id="test")

        events = []
        engine.event_callback = lambda e: events.append(e)

        result = await engine.execute(graph, state)
        assert result == "조명을 켰습니다!"

        # Service should NOT have been called
        hass.services.async_call.assert_not_called()

        # Check that tool result contains DRY RUN
        tool_results = [e for e in events if e.event_type == "tool_result"]
        assert len(tool_results) == 1
        assert "DRY RUN" in tool_results[0].data["result"]

    @pytest.mark.asyncio
    async def test_dry_run_allows_template_tools(self):
        """Dry-run에서 template tool(조회)은 허용되는지."""
        graph = GraphV2(TOOL_AGENT)
        client = AsyncMock()
        hass = MagicMock()

        tool_call = make_tool_call("tc1", "get_temp", {})
        first_resp = make_llm_response(None, tool_calls=[tool_call])
        second_resp = make_llm_response("현재 온도는 24.5도입니다")

        client.chat.completions.create.side_effect = [first_resp, second_resp]

        # Mock template rendering via homeassistant.helpers.template stub
        import sys
        tmpl_mock = MagicMock()
        mock_template_instance = MagicMock()
        mock_template_instance.async_render.return_value = "24.5"
        tmpl_mock.Template.return_value = mock_template_instance
        sys.modules["homeassistant.helpers.template"] = tmpl_mock

        engine = EngineV2(hass=hass, client=client, dry_run=True)
        state = GraphState(user_input="온도 알려줘", conversation_id="test")
        result = await engine.execute(graph, state)

        assert result == "현재 온도는 24.5도입니다"


class TestParallelExecution:

    @pytest.mark.asyncio
    async def test_parallel_fan_out(self):
        """병렬 실행이 동작하는지."""
        data = {
            "name": "parallel",
            "model": "gpt-4o",
            "nodes": {
                "search": {"type": "agent", "prompt": "Search"},
                "knowledge": {"type": "agent", "prompt": "Knowledge"},
                "summary": {"type": "agent", "prompt": "Summarize"},
            },
            "edges": [
                "START -> search, knowledge",
                "search -> summary",
                "knowledge -> summary",
                "summary -> END",
            ],
        }
        graph = GraphV2(data)
        client = AsyncMock()

        search_resp = make_llm_response("Search result")
        knowledge_resp = make_llm_response("Knowledge result")
        summary_resp = make_llm_response("Combined summary")

        client.chat.completions.create.side_effect = [
            search_resp, knowledge_resp, summary_resp,
        ]

        engine = EngineV2(hass=MagicMock(), client=client)
        state = GraphState(user_input="test", conversation_id="test")

        result = await engine.execute(graph, state)
        assert result == "Combined summary"
        assert client.chat.completions.create.call_count == 3


class TestTokenTracking:

    @pytest.mark.asyncio
    async def test_token_usage_tracked(self):
        """토큰 사용량이 추적되는지."""
        graph = GraphV2(SIMPLE_AGENT)
        client = AsyncMock()
        client.chat.completions.create.return_value = make_llm_response("ok")

        events = []
        engine = EngineV2(
            hass=MagicMock(), client=client,
            event_callback=lambda e: events.append(e),
        )
        state = GraphState(user_input="test", conversation_id="test")
        await engine.execute(graph, state)

        finished = [e for e in events if e.event_type == "node_finished"]
        assert len(finished) == 1
        assert finished[0].data["token_usage"]["total_tokens"] == 75
