"""Graph definition v2 — LangGraph-inspired simplified format.

New YAML format:
    name: 스마트홈 에이전트
    model: gpt-4o
    model_params:
      temperature: 0.7

    nodes:
      classify:
        type: router
        prompt: "사용자 의도를 분류하세요"
        routes: [smart_home, weather]

      smart_home_agent:
        type: agent
        prompt: "스마트홈을 제어하세요"
        tools:
          - name: turn_on_light
            description: "조명 켜기"
            service: light.turn_on
            params:
              entity_id: {type: string, description: "엔티티 ID"}
          - name: get_temp
            description: "온도 조회"
            template: "{{ states('sensor.temperature') }}"

      fallback:
        type: agent
        prompt: "일반 대화를 처리하세요"

    edges:
      - START -> classify
      - classify:
          smart_home -> smart_home_agent
          weather -> weather_agent
      - smart_home_agent -> END
      - weather_agent -> END

Edge syntax:
    - "A -> B"                   simple edge
    - "A -> B, C"                parallel fan-out
    - "A:"                       conditional routing (dict form)
        "value1 -> B"
        "value2 -> C"
    - "START -> A"               entry point
    - "A -> END"                 exit point
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .exceptions import InvalidGraph, GraphNotFound

_LOGGER = logging.getLogger(__name__)

# Special node names
START = "__START__"
END = "__END__"


# ── Data classes ──

@dataclass
class ToolDef:
    """Inline tool definition for an agent node."""
    name: str
    description: str = ""
    # Exactly one of these identifies the tool type:
    service: str | None = None       # native HA service call
    template: str | None = None      # Jinja2 template (state query)
    url: str | None = None           # web request
    # For service/web:
    params: dict[str, Any] = field(default_factory=dict)
    method: str = "GET"              # for web tools
    headers: dict[str, str] = field(default_factory=dict)
    payload: dict[str, Any] = field(default_factory=dict)

    @property
    def tool_type(self) -> str:
        if self.service:
            return "native"
        if self.template:
            return "template"
        if self.url:
            return "web"
        return "unknown"

    def to_function_spec(self) -> dict[str, Any]:
        """Convert to OpenAI function-calling spec."""
        properties = {}
        required = []
        for param_name, param_def in self.params.items():
            if isinstance(param_def, dict):
                properties[param_name] = {
                    "type": param_def.get("type", "string"),
                    "description": param_def.get("description", ""),
                }
                if param_def.get("enum"):
                    properties[param_name]["enum"] = param_def["enum"]
                if param_def.get("required", True):
                    required.append(param_name)
            else:
                # Shorthand: param_name: type_string
                properties[param_name] = {"type": str(param_def)}
                required.append(param_name)

        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        }

    def to_function_config(self) -> dict[str, Any]:
        """Convert to function execution config."""
        if self.service:
            return {"type": "native", "service": self.service, "data": {}}
        if self.template:
            return {"type": "template", "value_template": self.template}
        if self.url:
            cfg: dict[str, Any] = {"type": "web", "url": self.url, "method": self.method}
            if self.headers:
                cfg["headers"] = self.headers
            if self.payload:
                cfg["payload"] = self.payload
            return cfg
        return {"type": "unknown"}


@dataclass
class EdgeDef:
    """A directed edge in the graph."""
    source: str              # node name or START
    target: str              # node name or END
    condition: str | None = None   # route value (for conditional edges from router)
    parallel: bool = False         # True if part of a fan-out group


@dataclass
class NodeDef:
    """A node in the graph."""
    name: str
    type: str                # "router" | "agent" | "condition"
    prompt: str = ""
    model: str | None = None
    model_params: dict[str, Any] = field(default_factory=dict)

    # Router-specific
    routes: list[str] = field(default_factory=list)

    # Agent-specific
    tools: list[ToolDef] = field(default_factory=list)
    output_schema: list[dict[str, Any]] = field(default_factory=list)
    max_tool_iterations: int | None = None

    # Condition-specific
    conditions: list[dict[str, str]] = field(default_factory=list)  # [{"when": ..., "value": ...}]
    default: str | None = None


class GraphV2:
    """Graph definition v2 — LangGraph-inspired format."""

    def __init__(self, data: dict[str, Any], file_path: Path | None = None):
        self.name: str = data.get("name", "Untitled")
        self.description: str = data.get("description", "")
        self.model: str = data.get("model", "gpt-5.4")
        self.model_params: dict[str, Any] = data.get("model_params") or {}
        self.system_prompt_prefix: str = data.get("system_prompt_prefix", "")
        self.max_tool_iterations: int = data.get("max_tool_iterations", 10)
        self.file_path = file_path
        self._raw = data

        # Parse nodes
        self.nodes: dict[str, NodeDef] = self._parse_nodes(data.get("nodes", {}))

        # Parse edges
        self.edges: list[EdgeDef] = self._parse_edges(data.get("edges", []))

        # Derive graph ID from name (slugified) or explicit id
        self.id: str = data.get("id", self._slugify(self.name))

        self._validate()

    # ── Parsing ──

    def _parse_nodes(self, nodes_data: dict[str, Any]) -> dict[str, NodeDef]:
        """Parse nodes dict into NodeDef objects."""
        nodes = {}
        for name, config in nodes_data.items():
            if not isinstance(config, dict):
                raise InvalidGraph(f"Node '{name}' must be a dict, got {type(config).__name__}")

            node_type = config.get("type", "agent")
            tools = []
            for tool_data in config.get("tools", []):
                tools.append(ToolDef(
                    name=tool_data.get("name", ""),
                    description=tool_data.get("description", ""),
                    service=tool_data.get("service"),
                    template=tool_data.get("template"),
                    url=tool_data.get("url"),
                    params=tool_data.get("params", {}),
                    method=tool_data.get("method", "GET"),
                    headers=tool_data.get("headers", {}),
                    payload=tool_data.get("payload", {}),
                ))

            nodes[name] = NodeDef(
                name=name,
                type=node_type,
                prompt=config.get("prompt", ""),
                model=config.get("model"),
                model_params=config.get("model_params", {}),
                routes=config.get("routes", []),
                tools=tools,
                output_schema=config.get("output_schema", []),
                max_tool_iterations=config.get("max_tool_iterations"),
                conditions=config.get("conditions", []),
                default=config.get("default"),
            )
        return nodes

    def _parse_edges(self, edges_data: list) -> list[EdgeDef]:
        """Parse edge definitions from mixed string/dict list."""
        edges = []
        for item in edges_data:
            if isinstance(item, str):
                edges.extend(self._parse_edge_string(item))
            elif isinstance(item, dict):
                edges.extend(self._parse_edge_dict(item))
            else:
                raise InvalidGraph(f"Invalid edge format: {item}")
        return edges

    def _parse_edge_string(self, s: str) -> list[EdgeDef]:
        """Parse "A -> B" or "A -> B, C" (parallel) edge strings."""
        s = s.strip()
        if "->" not in s:
            raise InvalidGraph(f"Invalid edge syntax (missing ->): '{s}'")

        # Check for conditional prefix: "router: value -> target"
        if ":" in s.split("->")[0]:
            return self._parse_conditional_edge_string(s)

        parts = s.split("->", 1)
        source = parts[0].strip()
        targets_str = parts[1].strip()

        # Normalize START/END
        source = self._normalize_special(source)

        # Multiple targets = parallel
        targets = [t.strip() for t in targets_str.split(",")]
        targets = [self._normalize_special(t) for t in targets]
        is_parallel = len(targets) > 1

        return [
            EdgeDef(source=source, target=t, parallel=is_parallel)
            for t in targets
        ]

    def _parse_conditional_edge_string(self, s: str) -> list[EdgeDef]:
        """Parse "router: value -> target" conditional edge."""
        colon_idx = s.index(":")
        source = s[:colon_idx].strip()
        rest = s[colon_idx + 1:].strip()

        if "->" not in rest:
            raise InvalidGraph(f"Invalid conditional edge syntax: '{s}'")

        parts = rest.split("->", 1)
        condition = parts[0].strip()
        target = self._normalize_special(parts[1].strip())

        return [EdgeDef(source=source, target=target, condition=condition)]

    def _parse_edge_dict(self, d: dict) -> list[EdgeDef]:
        """Parse dict-form edges (conditional routing).

        Format:
            classify:
                smart_home -> smart_home_agent
                weather -> weather_agent
        """
        edges = []
        for source, routes in d.items():
            source = source.strip()
            if isinstance(routes, str):
                # Single route string
                for edge in self._parse_route_line(source, routes):
                    edges.append(edge)
            elif isinstance(routes, dict):
                # Dict of condition -> target
                for condition, target in routes.items():
                    target = self._normalize_special(str(target).strip())
                    edges.append(EdgeDef(
                        source=source,
                        target=target,
                        condition=str(condition).strip(),
                    ))
            elif isinstance(routes, list):
                # List of route strings
                for route_str in routes:
                    for edge in self._parse_route_line(source, str(route_str)):
                        edges.append(edge)
            else:
                raise InvalidGraph(f"Invalid route format for node '{source}': {routes}")
        return edges

    def _parse_route_line(self, source: str, line: str) -> list[EdgeDef]:
        """Parse a single "value -> target" route line."""
        line = line.strip()
        if "->" not in line:
            raise InvalidGraph(f"Invalid route syntax: '{line}'")
        parts = line.split("->", 1)
        condition = parts[0].strip()
        target = self._normalize_special(parts[1].strip())
        return [EdgeDef(source=source, target=target, condition=condition)]

    # ── Validation ──

    def _validate(self):
        if not self.nodes:
            raise InvalidGraph(f"Graph '{self.name}' has no nodes")

        node_names = set(self.nodes.keys())

        # Validate edges reference valid nodes
        has_start = False
        has_end = False
        for edge in self.edges:
            if edge.source == START:
                has_start = True
            elif edge.source not in node_names:
                raise InvalidGraph(f"Edge references unknown source node '{edge.source}'")

            if edge.target == END:
                has_end = True
            elif edge.target not in node_names:
                raise InvalidGraph(f"Edge references unknown target node '{edge.target}'")

        if not has_start:
            raise InvalidGraph(f"Graph '{self.name}' has no START edge")
        if not has_end:
            raise InvalidGraph(f"Graph '{self.name}' has no END edge")

        # Validate node types
        for name, node in self.nodes.items():
            if node.type not in ("router", "agent", "condition"):
                raise InvalidGraph(
                    f"Node '{name}' has invalid type '{node.type}'. "
                    f"Must be: router, agent, condition"
                )
            if node.type == "router" and not node.routes:
                raise InvalidGraph(f"Router node '{name}' must have 'routes' list")
            if node.type == "router" and not node.prompt:
                raise InvalidGraph(f"Router node '{name}' must have a 'prompt'")

        # Validate router edges match routes
        for name, node in self.nodes.items():
            if node.type != "router":
                continue
            conditional_edges = [e for e in self.edges if e.source == name and e.condition]
            edge_values = {e.condition for e in conditional_edges}
            route_values = set(node.routes)
            missing = route_values - edge_values
            if missing:
                raise InvalidGraph(
                    f"Router '{name}' has routes {sorted(missing)} "
                    f"without matching edges"
                )

    # ── Accessors ──

    def get_start_nodes(self) -> list[str]:
        """Return node names connected from START."""
        return [e.target for e in self.edges if e.source == START]

    def get_outgoing_edges(self, node_name: str) -> list[EdgeDef]:
        """Return all edges from a node."""
        return [e for e in self.edges if e.source == node_name]

    def get_incoming_edges(self, node_name: str) -> list[EdgeDef]:
        """Return all edges to a node."""
        return [e for e in self.edges if e.target == node_name]

    def get_end_nodes(self) -> list[str]:
        """Return node names connected to END."""
        return [e.source for e in self.edges if e.target == END]

    def to_dict(self) -> dict[str, Any]:
        """Serialize back to YAML-compatible dict."""
        nodes_dict = {}
        for name, node in self.nodes.items():
            nd: dict[str, Any] = {"type": node.type}
            if node.prompt:
                nd["prompt"] = node.prompt
            if node.model:
                nd["model"] = node.model
            if node.model_params:
                nd["model_params"] = node.model_params
            if node.routes:
                nd["routes"] = node.routes
            if node.tools:
                nd["tools"] = []
                for t in node.tools:
                    td: dict[str, Any] = {"name": t.name}
                    if t.description:
                        td["description"] = t.description
                    if t.service:
                        td["service"] = t.service
                    if t.template:
                        td["template"] = t.template
                    if t.url:
                        td["url"] = t.url
                        td["method"] = t.method
                    if t.params:
                        td["params"] = t.params
                    nd["tools"].append(td)
            if node.output_schema:
                nd["output_schema"] = node.output_schema
            if node.conditions:
                nd["conditions"] = node.conditions
            if node.default is not None:
                nd["default"] = node.default
            nodes_dict[name] = nd

        # Serialize edges back to readable format
        edge_list = []
        # Group conditional edges by source
        conditional_groups: dict[str, dict[str, str]] = {}
        simple_edges: list[EdgeDef] = []

        for edge in self.edges:
            if edge.condition:
                conditional_groups.setdefault(edge.source, {})[edge.condition] = (
                    "END" if edge.target == END else edge.target
                )
            else:
                simple_edges.append(edge)

        for edge in simple_edges:
            src = "START" if edge.source == START else edge.source
            tgt = "END" if edge.target == END else edge.target
            edge_list.append(f"{src} -> {tgt}")

        for source, routes in conditional_groups.items():
            edge_list.append({source: routes})

        result: dict[str, Any] = {"name": self.name}
        if self.id != self._slugify(self.name):
            result["id"] = self.id
        if self.description:
            result["description"] = self.description
        result["model"] = self.model
        if self.model_params:
            result["model_params"] = self.model_params
        if self.system_prompt_prefix:
            result["system_prompt_prefix"] = self.system_prompt_prefix
        result["nodes"] = nodes_dict
        result["edges"] = edge_list
        return result

    # ── Helpers ──

    @staticmethod
    def _normalize_special(name: str) -> str:
        upper = name.upper()
        if upper == "START":
            return START
        if upper == "END":
            return END
        return name

    @staticmethod
    def _slugify(name: str) -> str:
        slug = re.sub(r"[^\w\s-]", "", name.lower())
        slug = re.sub(r"[\s_]+", "_", slug).strip("_")
        return slug or "untitled"


class GraphLoaderV2:
    """Loads and saves v2 graph definitions from YAML files."""

    def __init__(self, graphs_dir: str):
        self.graphs_dir = Path(graphs_dir)

    def load_all(self) -> list[GraphV2]:
        if not self.graphs_dir.exists():
            return []
        graphs = []
        for path in sorted(self.graphs_dir.glob("*.yaml")):
            try:
                graphs.append(self.load_from_file(path))
            except Exception as err:
                _LOGGER.warning("Failed to load graph from %s: %s", path, err)
        return graphs

    def load_from_file(self, path: Path) -> GraphV2:
        with open(path) as f:
            data = yaml.safe_load(f)
        return GraphV2(data, file_path=path)

    def load_by_id(self, graph_id: str) -> GraphV2:
        path = self.graphs_dir / f"{graph_id}.yaml"
        if not path.exists():
            raise GraphNotFound(graph_id)
        return self.load_from_file(path)

    def save(self, graph: GraphV2) -> None:
        self.graphs_dir.mkdir(parents=True, exist_ok=True)
        path = self.graphs_dir / f"{graph.id}.yaml"
        data = graph.to_dict()
        data["id"] = graph.id
        with open(path, "w") as f:
            yaml.dump(data, f, default_flow_style=False, allow_unicode=True)

    def save_from_dict(self, data: dict[str, Any]) -> GraphV2:
        """Parse, validate, and save a graph from raw dict."""
        graph = GraphV2(data)
        self.save(graph)
        return graph

    def delete(self, graph_id: str) -> None:
        path = self.graphs_dir / f"{graph_id}.yaml"
        if not path.exists():
            raise GraphNotFound(graph_id)
        path.unlink()

    def list_ids(self) -> list[str]:
        return [p.stem for p in sorted(self.graphs_dir.glob("*.yaml"))]
