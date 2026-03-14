"""Skill definition loader."""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Any
import yaml
from .exceptions import SkillNotFound, InvalidSkill

_LOGGER = logging.getLogger(__name__)


class SkillDefinition:
    """Represents a skill definition (a named collection of functions)."""

    def __init__(self, data: dict[str, Any], file_path: Path | None = None):
        self.id: str = data.get("id", "")
        self.name: str = data.get("name", self.id)
        self.group: str = data.get("group", "")
        self.description: str = data.get("description", "")
        self.functions: list[dict[str, Any]] = data.get("functions", [])
        self.file_path = file_path
        self._raw = data
        self._validate()

    def _validate(self):
        if not self.id:
            raise InvalidSkill("Skill must have an 'id' field")

    def to_dict(self) -> dict[str, Any]:
        return self._raw


class SkillLoader:
    """Loads and saves skill definitions from YAML files."""

    def __init__(self, skills_dir: str):
        self.skills_dir = Path(skills_dir)

    def load_all(self) -> list[SkillDefinition]:
        if not self.skills_dir.exists():
            return []
        skills = []
        for path in sorted(self.skills_dir.glob("*.yaml")):
            try:
                skill = self.load_from_file(path)
                skills.append(skill)
            except Exception as err:
                _LOGGER.warning("Failed to load skill from %s: %s", path, err)
        return skills

    def load_from_file(self, path: Path) -> SkillDefinition:
        with open(path) as f:
            data = yaml.safe_load(f)
        return SkillDefinition(data, file_path=path)

    def load_by_id(self, skill_id: str) -> SkillDefinition:
        path = self.skills_dir / f"{skill_id}.yaml"
        if not path.exists():
            raise SkillNotFound(skill_id)
        return self.load_from_file(path)

    def save(self, skill_data: dict[str, Any]) -> None:
        skill_id = skill_data.get("id", "")
        if not skill_id:
            raise InvalidSkill("Skill must have an 'id' field")
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        path = self.skills_dir / f"{skill_id}.yaml"
        with open(path, "w") as f:
            yaml.dump(skill_data, f, default_flow_style=False, allow_unicode=True)

    def delete(self, skill_id: str) -> None:
        path = self.skills_dir / f"{skill_id}.yaml"
        if not path.exists():
            raise SkillNotFound(skill_id)
        path.unlink()
