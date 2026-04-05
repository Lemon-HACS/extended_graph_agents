"""새 그래프 포맷 (v2) 파서 테스트."""
import pytest
import yaml
import sys

# conftest에서 HA stub이 이미 로드됨
from custom_components.extended_graph_agents.graph_v2 import (
    GraphV2,
    GraphLoaderV2,
    NodeDef,
    EdgeDef,
    ToolDef,
    START,
    END,
)
from custom_components.extended_graph_agents.exceptions import InvalidGraph


# ── 샘플 데이터 ──

SIMPLE_GRAPH = {
    "name": "간단한 에이전트",
    "model": "gpt-4o",
    "nodes": {
        "chatbot": {
            "type": "agent",
            "prompt": "친절하게 대화하세요",
        },
    },
    "edges": [
        "START -> chatbot",
        "chatbot -> END",
    ],
}

ROUTER_GRAPH = {
    "name": "스마트홈 에이전트",
    "model": "gpt-4o",
    "model_params": {"temperature": 0.7},
    "nodes": {
        "classify": {
            "type": "router",
            "prompt": "사용자 의도를 분류하세요",
            "routes": ["smart_home", "general"],
        },
        "smart_home_agent": {
            "type": "agent",
            "prompt": "스마트홈을 제어하세요",
            "tools": [
                {
                    "name": "turn_on_light",
                    "description": "조명 켜기",
                    "service": "light.turn_on",
                    "params": {
                        "entity_id": {"type": "string", "description": "엔티티 ID"},
                        "brightness_pct": {"type": "number", "description": "밝기", "required": False},
                    },
                },
                {
                    "name": "get_temperature",
                    "description": "온도 조회",
                    "template": "{{ states('sensor.temperature') }}",
                },
            ],
        },
        "fallback": {
            "type": "agent",
            "prompt": "일반 대화를 처리하세요",
        },
    },
    "edges": [
        "START -> classify",
        {
            "classify": {
                "smart_home": "smart_home_agent",
                "general": "fallback",
            }
        },
        "smart_home_agent -> END",
        "fallback -> END",
    ],
}

CONDITION_GRAPH = {
    "name": "조건 분기 테스트",
    "model": "gpt-4o",
    "nodes": {
        "check_time": {
            "type": "condition",
            "conditions": [
                {"when": "{{ now().hour < 12 }}", "value": "morning"},
                {"when": "{{ now().hour < 18 }}", "value": "afternoon"},
            ],
            "default": "evening",
        },
        "morning_agent": {
            "type": "agent",
            "prompt": "좋은 아침입니다",
        },
        "afternoon_agent": {
            "type": "agent",
            "prompt": "좋은 오후입니다",
        },
        "evening_agent": {
            "type": "agent",
            "prompt": "좋은 저녁입니다",
        },
    },
    "edges": [
        "START -> check_time",
        {
            "check_time": [
                "morning -> morning_agent",
                "afternoon -> afternoon_agent",
                "evening -> evening_agent",
            ]
        },
        "morning_agent -> END",
        "afternoon_agent -> END",
        "evening_agent -> END",
    ],
}

PARALLEL_GRAPH = {
    "name": "병렬 실행 테스트",
    "model": "gpt-4o",
    "nodes": {
        "search_agent": {
            "type": "agent",
            "prompt": "웹 검색",
        },
        "knowledge_agent": {
            "type": "agent",
            "prompt": "지식 검색",
        },
        "summarizer": {
            "type": "agent",
            "prompt": "결과 요약",
        },
    },
    "edges": [
        "START -> search_agent, knowledge_agent",
        "search_agent -> summarizer",
        "knowledge_agent -> summarizer",
        "summarizer -> END",
    ],
}


# ── 파싱 테스트 ──

class TestGraphV2Parsing:

    def test_simple_graph(self):
        g = GraphV2(SIMPLE_GRAPH)
        assert g.name == "간단한 에이전트"
        assert g.model == "gpt-4o"
        assert len(g.nodes) == 1
        assert "chatbot" in g.nodes
        assert g.nodes["chatbot"].type == "agent"

    def test_router_graph(self):
        g = GraphV2(ROUTER_GRAPH)
        assert len(g.nodes) == 3
        assert g.nodes["classify"].type == "router"
        assert g.nodes["classify"].routes == ["smart_home", "general"]
        assert g.model_params == {"temperature": 0.7}

    def test_condition_graph(self):
        g = GraphV2(CONDITION_GRAPH)
        node = g.nodes["check_time"]
        assert node.type == "condition"
        assert len(node.conditions) == 2
        assert node.default == "evening"

    def test_parallel_graph(self):
        g = GraphV2(PARALLEL_GRAPH)
        start_edges = [e for e in g.edges if e.source == START]
        assert len(start_edges) == 2
        assert all(e.parallel for e in start_edges)

    def test_auto_id_from_name(self):
        g = GraphV2(SIMPLE_GRAPH)
        assert g.id == "간단한_에이전트"

    def test_explicit_id(self):
        data = {**SIMPLE_GRAPH, "id": "my_custom_id"}
        g = GraphV2(data)
        assert g.id == "my_custom_id"


# ── 엣지 파싱 테스트 ──

class TestEdgeParsing:

    def test_simple_edge(self):
        g = GraphV2(SIMPLE_GRAPH)
        assert len(g.edges) == 2
        assert g.edges[0].source == START
        assert g.edges[0].target == "chatbot"
        assert g.edges[1].source == "chatbot"
        assert g.edges[1].target == END

    def test_conditional_edges_dict_form(self):
        g = GraphV2(ROUTER_GRAPH)
        cond_edges = [e for e in g.edges if e.condition]
        assert len(cond_edges) == 2
        by_condition = {e.condition: e.target for e in cond_edges}
        assert by_condition["smart_home"] == "smart_home_agent"
        assert by_condition["general"] == "fallback"

    def test_conditional_edges_list_form(self):
        g = GraphV2(CONDITION_GRAPH)
        cond_edges = [e for e in g.edges if e.source == "check_time" and e.condition]
        assert len(cond_edges) == 3
        by_condition = {e.condition: e.target for e in cond_edges}
        assert by_condition["morning"] == "morning_agent"
        assert by_condition["afternoon"] == "afternoon_agent"
        assert by_condition["evening"] == "evening_agent"

    def test_parallel_fan_out(self):
        g = GraphV2(PARALLEL_GRAPH)
        start_edges = [e for e in g.edges if e.source == START]
        assert len(start_edges) == 2
        targets = {e.target for e in start_edges}
        assert targets == {"search_agent", "knowledge_agent"}
        assert all(e.parallel for e in start_edges)

    def test_inline_conditional_edge(self):
        """인라인 조건 엣지: "router: value -> target" """
        data = {
            "name": "inline test",
            "model": "gpt-4o",
            "nodes": {
                "r": {"type": "router", "prompt": "route", "routes": ["a", "b"]},
                "a_node": {"type": "agent", "prompt": "a"},
                "b_node": {"type": "agent", "prompt": "b"},
            },
            "edges": [
                "START -> r",
                "r: a -> a_node",
                "r: b -> b_node",
                "a_node -> END",
                "b_node -> END",
            ],
        }
        g = GraphV2(data)
        cond = [e for e in g.edges if e.condition]
        assert len(cond) == 2

    def test_case_insensitive_start_end(self):
        data = {
            **SIMPLE_GRAPH,
            "edges": ["start -> chatbot", "chatbot -> end"],
        }
        g = GraphV2(data)
        assert g.edges[0].source == START
        assert g.edges[1].target == END


# ── 도구 정의 테스트 ──

class TestToolDef:

    def test_service_tool(self):
        g = GraphV2(ROUTER_GRAPH)
        tools = g.nodes["smart_home_agent"].tools
        light_tool = tools[0]
        assert light_tool.name == "turn_on_light"
        assert light_tool.tool_type == "native"
        assert light_tool.service == "light.turn_on"

    def test_template_tool(self):
        g = GraphV2(ROUTER_GRAPH)
        tools = g.nodes["smart_home_agent"].tools
        temp_tool = tools[1]
        assert temp_tool.name == "get_temperature"
        assert temp_tool.tool_type == "template"
        assert "states(" in temp_tool.template

    def test_function_spec_generation(self):
        g = GraphV2(ROUTER_GRAPH)
        tool = g.nodes["smart_home_agent"].tools[0]
        spec = tool.to_function_spec()
        assert spec["name"] == "turn_on_light"
        assert "entity_id" in spec["parameters"]["properties"]
        assert "entity_id" in spec["parameters"]["required"]
        # brightness_pct has required=False
        assert "brightness_pct" not in spec["parameters"]["required"]

    def test_function_config_native(self):
        tool = ToolDef(name="test", service="light.turn_on")
        cfg = tool.to_function_config()
        assert cfg["type"] == "native"
        assert cfg["service"] == "light.turn_on"

    def test_function_config_template(self):
        tool = ToolDef(name="test", template="{{ states('sensor.x') }}")
        cfg = tool.to_function_config()
        assert cfg["type"] == "template"

    def test_function_config_web(self):
        tool = ToolDef(name="test", url="https://api.example.com", method="POST")
        cfg = tool.to_function_config()
        assert cfg["type"] == "web"
        assert cfg["method"] == "POST"


# ── 유효성 검사 테스트 ──

class TestValidation:

    def test_no_nodes(self):
        with pytest.raises(InvalidGraph, match="no nodes"):
            GraphV2({"name": "bad", "nodes": {}, "edges": []})

    def test_no_start_edge(self):
        with pytest.raises(InvalidGraph, match="no START"):
            GraphV2({
                "name": "bad",
                "nodes": {"a": {"type": "agent", "prompt": "x"}},
                "edges": ["a -> END"],
            })

    def test_no_end_edge(self):
        with pytest.raises(InvalidGraph, match="no END"):
            GraphV2({
                "name": "bad",
                "nodes": {"a": {"type": "agent", "prompt": "x"}},
                "edges": ["START -> a"],
            })

    def test_unknown_node_in_edge(self):
        with pytest.raises(InvalidGraph, match="unknown"):
            GraphV2({
                "name": "bad",
                "nodes": {"a": {"type": "agent", "prompt": "x"}},
                "edges": ["START -> a", "a -> nonexistent", "a -> END"],
            })

    def test_invalid_node_type(self):
        with pytest.raises(InvalidGraph, match="invalid type"):
            GraphV2({
                "name": "bad",
                "nodes": {"a": {"type": "transformer", "prompt": "x"}},
                "edges": ["START -> a", "a -> END"],
            })

    def test_router_without_routes(self):
        with pytest.raises(InvalidGraph, match="must have 'routes'"):
            GraphV2({
                "name": "bad",
                "nodes": {"r": {"type": "router", "prompt": "x"}},
                "edges": ["START -> r", "r -> END"],
            })

    def test_router_missing_edge_for_route(self):
        with pytest.raises(InvalidGraph, match="without matching edges"):
            GraphV2({
                "name": "bad",
                "nodes": {
                    "r": {"type": "router", "prompt": "x", "routes": ["a", "b"]},
                    "a_node": {"type": "agent", "prompt": "a"},
                },
                "edges": [
                    "START -> r",
                    "r: a -> a_node",
                    # missing b route
                    "a_node -> END",
                ],
            })

    def test_invalid_edge_syntax(self):
        with pytest.raises(InvalidGraph, match="missing ->"):
            GraphV2({
                "name": "bad",
                "nodes": {"a": {"type": "agent", "prompt": "x"}},
                "edges": ["START to a", "a -> END"],
            })


# ── 직렬화 테스트 ──

class TestSerialization:

    def test_roundtrip_simple(self):
        g = GraphV2(SIMPLE_GRAPH)
        d = g.to_dict()
        g2 = GraphV2(d)
        assert g2.name == g.name
        assert len(g2.nodes) == len(g.nodes)
        assert len(g2.edges) == len(g.edges)

    def test_roundtrip_router(self):
        g = GraphV2(ROUTER_GRAPH)
        d = g.to_dict()
        g2 = GraphV2(d)
        assert len(g2.nodes) == 3
        assert g2.nodes["classify"].routes == ["smart_home", "general"]
        cond = [e for e in g2.edges if e.condition]
        assert len(cond) == 2


# ── GraphLoaderV2 테스트 ──

class TestGraphLoaderV2:

    def test_save_and_load(self, tmp_path):
        loader = GraphLoaderV2(str(tmp_path))
        g = GraphV2(ROUTER_GRAPH)
        loader.save(g)
        loaded = loader.load_by_id(g.id)
        assert loaded.name == "스마트홈 에이전트"
        assert len(loaded.nodes) == 3

    def test_save_from_dict(self, tmp_path):
        loader = GraphLoaderV2(str(tmp_path))
        g = loader.save_from_dict(SIMPLE_GRAPH)
        assert g.id in loader.list_ids()

    def test_delete(self, tmp_path):
        loader = GraphLoaderV2(str(tmp_path))
        g = GraphV2(SIMPLE_GRAPH)
        loader.save(g)
        loader.delete(g.id)
        assert g.id not in loader.list_ids()

    def test_load_all(self, tmp_path):
        loader = GraphLoaderV2(str(tmp_path))
        loader.save(GraphV2(SIMPLE_GRAPH))
        loader.save(GraphV2(ROUTER_GRAPH))
        all_graphs = loader.load_all()
        assert len(all_graphs) == 2
