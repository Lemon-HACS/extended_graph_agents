"""Exceptions for Extended Graph Agents."""


class ExtendedGraphAgentsError(Exception):
    pass


class GraphNotFound(ExtendedGraphAgentsError):
    def __init__(self, graph_id: str):
        super().__init__(f"Graph not found: {graph_id}")
        self.graph_id = graph_id


class NodeNotFound(ExtendedGraphAgentsError):
    def __init__(self, node_id: str):
        super().__init__(f"Node not found: {node_id}")
        self.node_id = node_id


class InvalidGraph(ExtendedGraphAgentsError):
    pass


class FunctionNotFound(ExtendedGraphAgentsError):
    def __init__(self, func_type: str):
        super().__init__(f"Function type not found: {func_type}")


class FunctionLoadFailed(ExtendedGraphAgentsError):
    pass


class InvalidFunction(ExtendedGraphAgentsError):
    pass


class ParseArgumentsFailed(ExtendedGraphAgentsError):
    def __init__(self, args: str):
        super().__init__(f"Failed to parse arguments: {args}")


class TokenLengthExceededError(ExtendedGraphAgentsError):
    def __init__(self, max_tokens: int):
        super().__init__(f"Token length exceeded: {max_tokens}")
        self.max_tokens = max_tokens


class GraphExecutionError(ExtendedGraphAgentsError):
    pass


class RouterError(ExtendedGraphAgentsError):
    pass
