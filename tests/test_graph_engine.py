"""그래프 엔진 기본 테스트 — 현재(레거시) 포맷 기준."""
import pytest

from custom_components.extended_graph_agents.graph_loader import (
    GraphDefinition,
    EdgeDefinition,
    GraphLoader,
)
from custom_components.extended_graph_agents.graph_state import GraphState
from custom_components.extended_graph_agents.exceptions import InvalidGraph


class TestGraphDefinitionParsing:

    def test_valid_graph_loads(self, sample_legacy_graph):
        graph = GraphDefinition(sample_legacy_graph)
        assert graph.id == "test_graph"
        assert graph.name == "테스트"
        assert len(graph.nodes) == 4
        assert len(graph.edges) == 3

    def test_graph_requires_id(self):
        with pytest.raises(InvalidGraph):
            GraphDefinition({"nodes": [{"id": "n1", "type": "input"}], "edges": []})

    def test_graph_requires_nodes(self):
        with pytest.raises(InvalidGraph):
            GraphDefinition({"id": "test", "nodes": [], "edges": []})

    def test_node_types(self, sample_legacy_graph):
        graph = GraphDefinition(sample_legacy_graph)
        types = {n["id"]: n["type"] for n in graph.nodes}
        assert types["input_1"] == "input"
        assert types["router_1"] == "router"
        assert types["agent_1"] == "regular"
        assert types["output_1"] == "output"

    def test_edge_conditions(self, sample_legacy_graph):
        graph = GraphDefinition(sample_legacy_graph)
        conditional = [e for e in graph.edges if e.condition]
        assert len(conditional) == 1
        assert conditional[0].condition["variable"] == "intent"
        assert conditional[0].condition["value"] == "smart_home"

    def test_input_output_properties(self, sample_legacy_graph):
        graph = GraphDefinition(sample_legacy_graph)
        assert graph.input_node is not None
        assert graph.input_node["type"] == "input"
        assert graph.output_node is not None
        assert graph.output_node["type"] == "output"

    def test_get_start_node(self, sample_legacy_graph):
        graph = GraphDefinition(sample_legacy_graph)
        assert graph.get_start_node()["type"] == "input"

    def test_get_outgoing_edges(self, sample_legacy_graph):
        graph = GraphDefinition(sample_legacy_graph)
        edges = graph.get_outgoing_edges("router_1")
        assert len(edges) == 1
        assert edges[0].target == "agent_1"

    def test_multiple_input_nodes_rejected(self):
        with pytest.raises(InvalidGraph, match="more than one input"):
            GraphDefinition({
                "id": "bad",
                "nodes": [
                    {"id": "i1", "type": "input"},
                    {"id": "i2", "type": "input"},
                ],
                "edges": [],
            })

    def test_invalid_edge_source(self):
        with pytest.raises(InvalidGraph, match="unknown source"):
            GraphDefinition({
                "id": "bad",
                "nodes": [{"id": "n1", "type": "input"}],
                "edges": [{"source": "nonexistent", "target": "n1"}],
            })


class TestEdgeDefinition:

    def test_defaults(self):
        edge = EdgeDefinition(source="a", target="b")
        assert edge.mode == "sequential"
        assert edge.condition is None

    def test_parallel_mode(self):
        edge = EdgeDefinition(source="a", target="b", mode="parallel")
        assert edge.mode == "parallel"


class TestGraphState:

    def test_get_set(self):
        state = GraphState(
            user_input="테스트",
            conversation_id="conv-123",
            event_callback=lambda *a: None,
        )
        state.set("key1", "value1")
        assert state.get("key1") == "value1"
        assert state.get("user_input") == "테스트"
        assert state.get("conversation_id") == "conv-123"
        assert state.get("nonexistent", "default") == "default"

    def test_template_context(self):
        state = GraphState(user_input="hello", conversation_id="c1", language="ko")
        state.set("route", "smart_home")
        state.node_outputs["agent_1"] = "결과"

        ctx = state.to_template_context()
        assert ctx["user_input"] == "hello"
        assert ctx["language"] == "ko"
        assert ctx["variables"]["route"] == "smart_home"
        assert ctx["node_outputs"]["agent_1"] == "결과"


class TestGraphLoader:

    def test_save_and_load(self, tmp_path, sample_legacy_graph):
        loader = GraphLoader(str(tmp_path))
        loader.save(sample_legacy_graph)
        loaded = loader.load_by_id("test_graph")
        assert loaded.id == "test_graph"
        assert loaded.name == "테스트"
        assert len(loaded.nodes) == 4

    def test_list_ids(self, tmp_path, sample_legacy_graph):
        loader = GraphLoader(str(tmp_path))
        loader.save(sample_legacy_graph)
        assert "test_graph" in loader.list_ids()

    def test_delete(self, tmp_path, sample_legacy_graph):
        loader = GraphLoader(str(tmp_path))
        loader.save(sample_legacy_graph)
        loader.delete("test_graph")
        assert "test_graph" not in loader.list_ids()

    def test_load_all_empty(self, tmp_path):
        loader = GraphLoader(str(tmp_path / "nonexistent"))
        assert loader.load_all() == []
