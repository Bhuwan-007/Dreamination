"""
World Kit Registry and Loader.
Loads all world kit definitions from config/world_kits/*.yaml and validates anchors, props, and presets.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml

logger = logging.getLogger("dream_machine.world_kits")

# Default path relative to repo root
DEFAULT_WORLD_KITS_DIR = Path(__file__).resolve().parents[4] / "config" / "world_kits"


@dataclass(frozen=True)
class AnchorDefinition:
    name: str
    pos: tuple[float, float, float]
    description: str


@dataclass(frozen=True)
class PropDefinition:
    id: str
    name: str
    allowed_anchors: tuple[str, ...]


@dataclass
class WorldKit:
    kit_id: str
    name: str
    description: str
    anchors: dict[str, AnchorDefinition] = field(default_factory=dict)
    props: dict[str, PropDefinition] = field(default_factory=dict)
    skies: list[str] = field(default_factory=list)
    lights: list[str] = field(default_factory=list)

    def is_anchor_valid(self, anchor_name: str) -> bool:
        return anchor_name in self.anchors

    def is_prop_valid(self, prop_id: str, anchor_name: str | None = None) -> bool:
        if prop_id not in self.props:
            return False
        if anchor_name is not None:
            return anchor_name in self.props[prop_id].allowed_anchors
        return True


class WorldKitRegistry:
    """Singleton-style registry for loaded world kits."""

    def __init__(self, kits_dir: Path | str | None = None) -> None:
        self.kits_dir = Path(kits_dir) if kits_dir else DEFAULT_WORLD_KITS_DIR
        self._kits: dict[str, WorldKit] = {}
        self.load_all()

    def load_all(self) -> None:
        """Loads and parses all YAML files from the kits directory."""
        if not self.kits_dir.exists():
            logger.warning(f"World kits directory not found at {self.kits_dir}")
            return

        for yaml_path in sorted(self.kits_dir.glob("*.yaml")):
            try:
                with yaml_path.open("r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    if not data or not isinstance(data, dict):
                        continue

                    kit_id = data.get("kit_id")
                    if not kit_id:
                        continue

                    anchors = {}
                    for a_name, a_data in data.get("anchors", {}).items():
                        pos = a_data.get("pos", [0.0, 0.0, 0.0])
                        anchors[a_name] = AnchorDefinition(
                            name=a_name,
                            pos=(float(pos[0]), float(pos[1]), float(pos[2])),
                            description=a_data.get("description", ""),
                        )

                    props = {}
                    for p in data.get("props", []):
                        pid = p.get("id")
                        if pid:
                            props[pid] = PropDefinition(
                                id=pid,
                                name=p.get("name", pid),
                                allowed_anchors=tuple(p.get("allowed_anchors", [])),
                            )

                    kit = WorldKit(
                        kit_id=kit_id,
                        name=data.get("name", kit_id),
                        description=data.get("description", ""),
                        anchors=anchors,
                        props=props,
                        skies=data.get("skies", []),
                        lights=data.get("lights", []),
                    )
                    self._kits[kit_id] = kit
            except Exception as e:
                logger.error(f"Failed to load world kit from {yaml_path}: {e}")

    def get_kit(self, kit_id: str) -> WorldKit | None:
        return self._kits.get(kit_id)

    def list_kits(self) -> list[str]:
        return sorted(self._kits.keys())

    def get_allowed_anchors(self, kit_id: str) -> set[str]:
        kit = self._kits.get(kit_id)
        return set(kit.anchors.keys()) if kit else set()

    def get_allowed_props(self, kit_id: str) -> set[str]:
        kit = self._kits.get(kit_id)
        return set(kit.props.keys()) if kit else set()

    def format_kits_for_prompt(self) -> str:
        """Formats a concise catalog of kits, anchors, props, and presets for LLM injection."""
        lines = []
        for kit_id in sorted(self._kits.keys()):
            kit = self._kits[kit_id]
            anchor_names = ", ".join(kit.anchors.keys())
            prop_names = ", ".join(f"{pid}(on {','.join(p.allowed_anchors)})" for pid, p in kit.props.items())
            sky_names = ", ".join(kit.skies)
            light_names = ", ".join(kit.lights)

            lines.append(f"- Kit: '{kit.kit_id}' ({kit.name})")
            lines.append(f"  Description: {kit.description}")
            lines.append(f"  Anchors: {anchor_names}")
            lines.append(f"  Props: {prop_names}")
            lines.append(f"  Skies: {sky_names}")
            lines.append(f"  Lights: {light_names}")
        return "\n".join(lines)


# Global singleton instance
world_kit_registry = WorldKitRegistry()
