"""Nodes package."""
from .base import BaseNode, NodeResult
from .router import RouterNode
from .regular import RegularNode
from .input import InputNode
from .output import OutputNode

_NODE_REGISTRY = {
    "router": RouterNode,
    "regular": RegularNode,
    "input": InputNode,
    "output": OutputNode,
}


def get_node(node_config: dict) -> BaseNode:
    node_type = node_config.get("type", "regular")
    cls = _NODE_REGISTRY.get(node_type)
    if cls is None:
        raise ValueError(f"Unknown node type: {node_type}")
    return cls(node_config)
