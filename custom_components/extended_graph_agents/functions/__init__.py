"""Functions package."""
from __future__ import annotations
from typing import Any
from .base import Function

_FUNCTION_REGISTRY: dict[str, type[Function]] = {}


def register_function(func_type: str):
    def decorator(cls: type[Function]):
        _FUNCTION_REGISTRY[func_type] = cls
        return cls

    return decorator


def get_function(func_type: str) -> Function:
    from ..exceptions import FunctionNotFound

    if func_type not in _FUNCTION_REGISTRY:
        raise FunctionNotFound(func_type)
    return _FUNCTION_REGISTRY[func_type]()


# Import all function modules to register them
from . import native, template, web  # noqa: F401, E402
