"""Helpers for Extended Graph Agents."""
from __future__ import annotations
from typing import Any
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er


def get_exposed_entities(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Get list of exposed entities."""
    entity_reg = er.async_get(hass)
    entities = []
    for entity in entity_reg.entities.values():
        state = hass.states.get(entity.entity_id)
        if state is None:
            continue
        entities.append({
            "entity_id": entity.entity_id,
            "name": state.name,
            "state": state.state,
            "attributes": dict(state.attributes),
            "domain": entity.domain,
        })
    return entities
