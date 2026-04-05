"""Extended Graph Agents 테스트 공통 fixture.

HA 의존성이 없는 모듈만 직접 import합니다.
__init__.py를 거치지 않도록 importlib로 개별 모듈을 로드합니다.
"""
import importlib.util
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

_COMP_DIR = Path(__file__).resolve().parent.parent / "custom_components" / "extended_graph_agents"

# HA 의존성 없는 순수 Python 모듈 목록 (로드 순서 중요)
_PURE_MODULES = ["exceptions", "graph_state", "graph_v2", "engine_v2"]


def _create_package_module(full_name: str) -> types.ModuleType:
    """빈 패키지 모듈 생성."""
    mod = types.ModuleType(full_name)
    mod.__path__ = []
    mod.__package__ = full_name
    return mod


def _load_comp_module(name: str) -> types.ModuleType:
    """custom_components.extended_graph_agents.{name} 모듈을 직접 로드."""
    full_name = f"custom_components.extended_graph_agents.{name}"
    file_path = _COMP_DIR / f"{name}.py"

    if not file_path.exists():
        raise FileNotFoundError(f"Module file not found: {file_path}")

    spec = importlib.util.spec_from_file_location(full_name, file_path)
    mod = importlib.util.module_from_spec(spec)
    mod.__package__ = "custom_components.extended_graph_agents"
    sys.modules[full_name] = mod
    spec.loader.exec_module(mod)
    return mod


# 패키지 구조 생성 (실제 __init__.py를 로드하지 않고 빈 패키지로)
sys.modules.setdefault("custom_components", _create_package_module("custom_components"))
_ega_pkg = _create_package_module("custom_components.extended_graph_agents")
_ega_pkg.__path__ = [str(_COMP_DIR)]
sys.modules["custom_components.extended_graph_agents"] = _ega_pkg

# 순수 모듈 로드
for mod_name in _PURE_MODULES:
    _load_comp_module(mod_name)


# ── Fixtures ──

@pytest.fixture
def mock_hass():
    """Home Assistant 인스턴스 mock."""
    hass = MagicMock()
    hass.config.path.return_value = "/tmp/ha_test_config"
    hass.states = MagicMock()
    hass.states.get.return_value = MagicMock(state="on")
    hass.services = MagicMock()
    hass.services.async_call = AsyncMock()
    return hass
