"""Graph definition loader."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Any
import yaml
from .exceptions import GraphNotFound, InvalidGraph

_LOGGER = logging.getLogger(__name__)


class GraphDefinition:
    """Represents a graph definition."""

    def __init__(self, data: dict[str, Any], file_path: Path | None = None):
        self.id: str = data.get("id", "")
        self.name: str = data.get("name", self.id)
        self.description: str = data.get("description", "")
        self.model: str = data.get("model", "gpt-4o")
        self.nodes: list[dict[str, Any]] = data.get("nodes", [])
        self.file_path = file_path
        self._raw = data

        self._validate()

    def _validate(self):
        if not self.id:
            raise InvalidGraph("Graph must have an 'id' field")
        if not self.nodes:
            raise InvalidGraph(f"Graph '{self.id}' has no nodes")
        node_ids = {n["id"] for n in self.nodes}
        for node in self.nodes:
            if "id" not in node:
                raise InvalidGraph("All nodes must have an 'id' field")
            if "type" not in node:
                raise InvalidGraph(f"Node '{node['id']}' must have a 'type' field")
            if node["type"] == "router":
                for route in node.get("routes", []):
                    for next_id in (route.get("next") or []):
                        if isinstance(next_id, str) and next_id not in node_ids:
                            raise InvalidGraph(
                                f"Router '{node['id']}' references unknown node '{next_id}'"
                            )

    def get_node(self, node_id: str) -> dict[str, Any] | None:
        return next((n for n in self.nodes if n["id"] == node_id), None)

    def get_start_node(self) -> dict[str, Any]:
        """Return first node as start."""
        return self.nodes[0]

    def to_dict(self) -> dict[str, Any]:
        return self._raw


class GraphLoader:
    """Loads and saves graph definitions from YAML files."""

    def __init__(self, graphs_dir: str):
        self.graphs_dir = Path(graphs_dir)
        self.graphs_dir.mkdir(parents=True, exist_ok=True)

    def load_all(self) -> list[GraphDefinition]:
        graphs = []
        for path in sorted(self.graphs_dir.glob("*.yaml")):
            try:
                graph = self.load_from_file(path)
                graphs.append(graph)
            except Exception as err:
                _LOGGER.warning("Failed to load graph from %s: %s", path, err)
        return graphs

    def load_from_file(self, path: Path) -> GraphDefinition:
        with open(path) as f:
            data = yaml.safe_load(f)
        return GraphDefinition(data, file_path=path)

    def load_by_id(self, graph_id: str) -> GraphDefinition:
        path = self.graphs_dir / f"{graph_id}.yaml"
        if not path.exists():
            raise GraphNotFound(graph_id)
        return self.load_from_file(path)

    def save(self, graph_data: dict[str, Any]) -> None:
        graph_id = graph_data.get("id", "")
        if not graph_id:
            raise InvalidGraph("Graph must have an 'id' field")
        path = self.graphs_dir / f"{graph_id}.yaml"
        with open(path, "w") as f:
            yaml.dump(graph_data, f, default_flow_style=False, allow_unicode=True)

    def delete(self, graph_id: str) -> None:
        path = self.graphs_dir / f"{graph_id}.yaml"
        if not path.exists():
            raise GraphNotFound(graph_id)
        path.unlink()

    def list_ids(self) -> list[str]:
        return [p.stem for p in sorted(self.graphs_dir.glob("*.yaml"))]
