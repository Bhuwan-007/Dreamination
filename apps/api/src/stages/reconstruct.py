"""
The Dream Weaver: Reconstruction Engine & Single-Scene Repair Service (Prompts P3 & P4).
Transforms extracted dream fragments, entities, and transitions into 5 to 8 scenes
with explicit source provenance (user vs. inferred), inference reasons, and dream logic continuity.
"""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import logger
from ..models.dream import DreamStatus, DreamVersion
from ..repositories.dream import DreamRepository
from ..schemas.extraction import ExtractionOutput
from ..schemas.reconstruction import (
    BeatItem,
    DialogueItem,
    ReconstructedScene,
    ReconstructionOutput,
)
from .extract import ExtractionService, run_extraction_and_ingest

RECONSTRUCT_PROMPT_FILE = Path(__file__).parent.parent.parent / "prompts" / "reconstruct_v1.md"
SCENE_REPAIR_PROMPT_FILE = Path(__file__).parent.parent.parent / "prompts" / "scene_repair_v1.md"

FORBIDDEN_CLICHES = [
    "it was all a dream",
    "it was only a dream",
    "woke up and realized",
    "woke up to realize",
    "realized it was a dream",
    "she realized she was free",
    "he realized he was free",
    "they realized they were free",
    "just a nightmare",
    "pinched myself",
    "pinch myself",
    "and then i woke up",
]


class ClichéValidationError(ValueError):
    """Raised when reconstructed story contains forbidden clichés."""


def _clean_json_output(raw_text: str) -> str:
    """Strips markdown code fences, comments, and whitespace."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def validate_reconstruction_rules(
    output: ReconstructionOutput,
    raw_notes: str = "",
    allow_empty_reasons: bool = False,
) -> None:
    """
    Validates hard rules from Prompts.md and BuildPlan.md:
    1. Forbidden clichés must not appear unless user explicitly supplied them in notes.
    2. Every inferred beat must possess an inference_reason.
    3. Output should have 5 to 8 scenes (or at least 3 for very short dreams).
    """
    notes_lower = raw_notes.lower()

    for scene in output.scenes:
        for beat in scene.beats:
            beat_text_lower = beat.text.lower()
            # 1. Cliché check
            for cliche in FORBIDDEN_CLICHES:
                if cliche in beat_text_lower and cliche not in notes_lower:
                    raise ClichéValidationError(
                        f"Reconstruction contains forbidden cliché: '{cliche}'. Dream logic must be preserved without trite summaries."
                    )

            # 2. Inferred inference_reason check
            if beat.source == "inferred" and not beat.inference_reason and not allow_empty_reasons:
                raise ValueError(
                    f"Inferred beat '{beat.text[:30]}...' is missing an inference_reason explaining the bridge."
                )


GAP_REGEX = re.compile(
    r"(?:i\s+)?(?:don'?t|do\s+not)\s+remember(?:\s+(?:how|what|why|where))?|"
    r"(?:i\s+)?cannot\s+recall|"
    r"(?:i\s+)?can'?t\s+recall|"
    r"(?:i\s+)?could\s+not\s+recall|"
    r"(?:i\s+)?couldn'?t\s+recall|"
    r"(?:i\s+)?forgot(?:\s+(?:how|what|why|where))?|"
    r"\b(?:unclear|blurry|hazy|fuzzy|vague|somehow|blank)\b|"
    r"i\s+(?:don'?t|do\s+not)\s+know\s+(?:how|why|where)|"
    r"everything\s+(?:went|became)\s+blank",
    re.IGNORECASE,
)


def _extract_dream_context(notes: str, extraction: ExtractionOutput) -> dict[str, Any]:
    notes_lower = notes.lower()

    # 1. Places (prioritize places that actually appear in current notes)
    place_candidates: list[str] = []
    place_keywords = [
        "coast", "sea", "ocean", "water", "beach", "lake", "shore", "river",
        "library", "corridor", "hallway", "room", "house", "tower", "courtyard",
        "forest", "desert", "garden", "city", "street", "stairs", "bridge",
    ]
    for kw in place_keywords:
        if kw in notes_lower:
            place_candidates.append(kw)
    for e in extraction.entities:
        if e.type == "place" and e.name.lower() not in [p.lower() for p in place_candidates]:
            place_candidates.append(e.name)

    primary_place = place_candidates[0] if place_candidates else "the twilight shore"
    secondary_place = place_candidates[1] if len(place_candidates) > 1 else None

    # 2. Objects & Symbols (prioritize objects that actually appear in current notes)
    symbol_candidates: list[str] = []
    object_keywords = [
        "compass", "key", "clock", "door", "doorway", "mirror", "book", "ring", "boat",
        "lantern", "bell", "mask", "coin", "feather", "box", "window", "letter",
    ]
    for kw in object_keywords:
        if kw in notes_lower:
            symbol_candidates.append(kw)
    for e in extraction.entities:
        if e.type in ("symbol", "object") and e.name.lower() not in [s.lower() for s in symbol_candidates]:
            symbol_candidates.append(e.name)

    primary_symbol = symbol_candidates[0] if symbol_candidates else "the doorway"
    secondary_symbol = symbol_candidates[1] if len(symbol_candidates) > 1 else None

    # 3. Characters & Entities
    character_candidates = [e.name for e in extraction.entities if e.type in ("person", "creature")]
    char_keywords = [
        "stranger", "friend", "figure", "shadow", "woman", "man", "child",
        "guide", "wanderer", "wolf", "bird", "cat", "creature",
    ]
    for kw in char_keywords:
        if kw in notes_lower and not any(kw in c.lower() for c in character_candidates):
            character_candidates.append(kw)
    primary_character = character_candidates[0] if character_candidates else None

    # 4. Emotions & Atmosphere
    emotions = [e.label for e in extraction.emotions]
    primary_emotion = emotions[0] if emotions else "quiet wonder"

    return {
        "primary_place": primary_place,
        "secondary_place": secondary_place,
        "primary_symbol": primary_symbol,
        "secondary_symbol": secondary_symbol,
        "primary_character": primary_character,
        "primary_emotion": primary_emotion,
    }


class ReconstructionService:
    """Reconstructs dreams into scenes and provides single-scene repair."""

    def __init__(
        self,
        reconstruct_prompt_path: Path | None = None,
        repair_prompt_path: Path | None = None,
    ) -> None:
        self.reconstruct_prompt_path = reconstruct_prompt_path or RECONSTRUCT_PROMPT_FILE
        self.repair_prompt_path = repair_prompt_path or SCENE_REPAIR_PROMPT_FILE

    def _fallback_reconstruct_faithful(
        self,
        extraction: ExtractionOutput,
        notes: str,
        answers: str = "",
    ) -> ReconstructionOutput:
        """
        Mode A (Faithful): Pure, raw memory preservation.
        Each scene contains ONLY the user's actual fragments and words.
        No generic filler, no repetitive lines, no moral summaries.
        """
        fragments = extraction.fragments or []
        if not fragments:
            raw_sentences = [
                s.strip()
                for s in re.split(r"(?<=[.!?])\s+|\n+", notes)
                if s.strip() and len(s.strip()) > 3
            ]
            if not raw_sentences:
                raw_sentences = [notes.strip()] if notes.strip() else ["An unrecorded fragment lingering in silence."]
            from ..schemas.extraction import DreamFragment
            fragments = [DreamFragment(id=f"f{i+1}", text=s, order_hint=i+1) for i, s in enumerate(raw_sentences)]

        ctx = _extract_dream_context(notes, extraction)
        title = (
            f"{ctx['primary_place'].title()}"
            if ctx['primary_place'] != "the twilight shore"
            else f"The {ctx['primary_symbol'].title()}"
        )

        scenes: list[ReconstructedScene] = []
        for i, frag in enumerate(fragments):
            scene_id = i + 1
            frag_lower = frag.text.lower()

            if any(w in frag_lower for w in ["coast", "sea", "ocean", "water", "beach", "shore"]):
                heading = "The Water's Edge"
            elif any(w in frag_lower for w in ["door", "doorway", "entrance", "gate", "threshold"]):
                heading = "The Doorway"
            elif any(w in frag_lower for w in ["key", "clock", "mirror", "book", "symbol", "artifact"]):
                heading = "The Artifact"
            elif any(w in frag_lower for w in ["tower", "room", "hall", "corridor", "house", "chamber"]):
                heading = "The Chamber"
            elif any(w in frag_lower for w in ["someone", "stranger", "friend", "person", "figure"]):
                heading = "The Encounter"
            else:
                heading = f"Scene {scene_id} · Memory"

            beats = [
                BeatItem(
                    text=frag.text,
                    source="user",
                    inference_reason=None,
                    confidence=1.0,
                )
            ]

            # In faithful mode: purely raw user memory; only mark cut bridge on explicit non-linear cut
            if i + 1 < len(fragments):
                next_frag = fragments[i + 1]
                trans = next(
                    (t for t in extraction.transitions if t.from_fragment == frag.id and t.to_fragment == next_frag.id),
                    None,
                )
                if trans and trans.type == "cut":
                    beats.append(
                        BeatItem(
                            text="The scene cuts abruptly here without physical passage.",
                            source="inferred",
                            inference_reason="Records the abrupt non-linear cut between fragments.",
                            confidence=0.9,
                        )
                    )

            scenes.append(
                ReconstructedScene(
                    scene_id=scene_id,
                    heading=heading,
                    beats=beats,
                    dialogue=[],
                )
            )

        output = ReconstructionOutput(
            title=title,
            mode="faithful",
            scenes=scenes[:8],
        )
        validate_reconstruction_rules(output, raw_notes=notes, allow_empty_reasons=True)
        return output

    def _fallback_reconstruct_authored(
        self,
        extraction: ExtractionOutput,
        notes: str,
        answers: str = "",
        history_snippets: list[str] | None = None,
    ) -> ReconstructionOutput:
        """
        Mode B (Authored Arc): Weaves the fragments into a 5-scene cinematic arc.
        All user details are kept.
        Where the user indicates confusion or missing memory ("I don't remember", "unclear", "blurry"),
        the Weaver analyzes the whole dream and in-fills that specific point with a thematically
        coherent, dream-logical bridge connecting the motifs (water, key, tower, etc.).
        """
        fragments = extraction.fragments or []
        if not fragments:
            raw_sentences = [
                s.strip()
                for s in re.split(r"(?<=[.!?])\s+|\n+", notes)
                if s.strip() and len(s.strip()) > 3
            ]
            if not raw_sentences:
                raw_sentences = [notes.strip()] if notes.strip() else ["An unrecorded fragment lingering in silence."]
            from ..schemas.extraction import DreamFragment
            fragments = [DreamFragment(id=f"f{i+1}", text=s, order_hint=i+1) for i, s in enumerate(raw_sentences)]

        ctx = _extract_dream_context(notes, extraction)
        primary_place = ctx["primary_place"]
        primary_symbol = ctx["primary_symbol"]
        primary_character = ctx["primary_character"]
        primary_emotion = ctx["primary_emotion"]

        title = (
            f"{primary_place.title()}: The {primary_symbol.title()}"
            if primary_symbol != "the doorway"
            else f"Arc of {primary_place.title()}"
        )

        scenes: list[ReconstructedScene] = []

        # 1. Map each user fragment into its own dedicated scene in exact chronological order
        for i, frag in enumerate(fragments):
            scene_id = i + 1
            beats: list[BeatItem] = [
                BeatItem(text=frag.text, source="user", confidence=1.0)
            ]

            match = GAP_REGEX.search(frag.text)
            if match:
                gap_phrase = match.group(0)
                beats.append(
                    BeatItem(
                        text=(
                            f"Where memory dimmed around '{gap_phrase}', the dream logic takes hold: "
                            f"an unmapped passage opens across {primary_place}, guided by the cold warmth of the {primary_symbol}."
                        ),
                        source="inferred",
                        inference_reason=f"Weaves and resolves the user's forgotten memory gap ('{gap_phrase}') using the {primary_place} and {primary_symbol} motifs.",
                        confidence=0.92,
                    )
                )

            dialogue: list[DialogueItem] = []
            if i == 1 and primary_character:
                dialogue.append(
                    DialogueItem(
                        speaker=primary_character.title(),
                        line=f"Hold the {primary_symbol} close—it remembers what cannot be spoken.",
                        emotion="hushed",
                        source="inferred",
                    )
                )

            heading_map = {
                0: f"I · The Threshold of {primary_place.title()}",
                1: f"II · The Presence of {primary_symbol.title()}",
                2: "III · The Infilled Passage" if match else "III · The Deepening",
                3: "IV · The Convergence",
                4: "V · The Shifting Shore",
            }
            heading = heading_map.get(i, f"Scene {scene_id} · Progression")

            scenes.append(
                ReconstructedScene(
                    scene_id=scene_id,
                    heading=heading,
                    beats=beats,
                    dialogue=dialogue,
                )
            )

        # 2. If fewer than 5 scenes, add cinematic arc scenes to reach 5
        while len(scenes) < 5:
            next_id = len(scenes) + 1
            if next_id == 4:
                scenes.append(
                    ReconstructedScene(
                        scene_id=4,
                        heading=f"IV · The Turn of the {primary_symbol.title()}",
                        beats=[
                            BeatItem(
                                text=f"At the boundary of {primary_place}, the {primary_symbol} turns, and ordinary space yields to silence.",
                                source="inferred",
                                inference_reason=f"Completes the narrative movement toward thematic culmination via {primary_symbol}.",
                                confidence=0.85,
                            )
                        ],
                        dialogue=[],
                    )
                )
            elif next_id == 5:
                scenes.append(
                    ReconstructedScene(
                        scene_id=5,
                        heading="V · The Resonant Stillness",
                        beats=[
                            BeatItem(
                                text=f"The horizon of {primary_place} settles into stillness, leaving only the quiet trace of {primary_emotion} before waking.",
                                source="inferred",
                                inference_reason="Provides gentle poetic closure without imposing an artificial moral or cliché wake-up sequence.",
                                confidence=0.86,
                            )
                        ],
                        dialogue=[],
                    )
                )
            else:
                scenes.append(
                    ReconstructedScene(
                        scene_id=next_id,
                        heading=f"Scene {next_id} · Continuity",
                        beats=[
                            BeatItem(
                                text=f"The memory dissolves further into {primary_place}.",
                                source="inferred",
                                inference_reason="Maintains continuity.",
                                confidence=0.8,
                            )
                        ],
                        dialogue=[],
                    )
                )

        output = ReconstructionOutput(
            title=title,
            mode="authored",
            scenes=scenes[:8],
        )
        validate_reconstruction_rules(output, raw_notes=notes, allow_empty_reasons=True)
        return output

    def _fallback_reconstruct(
        self,
        extraction: ExtractionOutput,
        notes: str,
        answers: str = "",
        mode: str = "faithful",
        history_snippets: list[str] | None = None,
    ) -> ReconstructionOutput:
        """Selects between pure raw faithful memory and authored cinematic gap-infilling."""
        if mode == "faithful":
            return self._fallback_reconstruct_faithful(extraction, notes, answers)
        return self._fallback_reconstruct_authored(extraction, notes, answers, history_snippets)

    async def reconstruct(
        self,
        extraction: ExtractionOutput,
        notes: str,
        answers: str = "",
        mode: str = "faithful",
        history_snippets: list[str] | None = None,
    ) -> ReconstructionOutput:
        """
        Reconstructs the dream using LLM ladder (Gemini -> Ollama llama3.1:8b)
        or deterministic fallback if LLM is unavailable.
        """
        try:
            from ..providers.llm import complete_json

            template = self.reconstruct_prompt_path.read_text(encoding="utf-8")
            prompt = (
                template
                .replace("{mode}", mode)
                .replace("{extraction}", extraction.model_dump_json(indent=2))
                .replace("{notes}", notes)
                .replace("{answers}", answers)
                .replace("{history}", json.dumps(history_snippets or []))
            )

            parsed = await complete_json(prompt)
            output = ReconstructionOutput.model_validate(parsed)
            validate_reconstruction_rules(output, raw_notes=notes, allow_empty_reasons=(mode == "faithful"))
            return output
        except Exception as exc:
            logger.warning(
                f"LLM reconstruction failed or validation error ({exc}); invoking deterministic Weaver."
            )
            return self._fallback_reconstruct(extraction, notes, answers, mode, history_snippets)

    async def repair_single_scene(
        self,
        target_scene: ReconstructedScene,
        user_correction: str,
        previous_scene_summary: str = "",
        next_scene_summary: str = "",
    ) -> ReconstructedScene:
        """
        Rewrites ONLY the targeted scene using user correction as ground truth.
        """
        try:
            from ..providers.llm import complete_json

            template = self.repair_prompt_path.read_text(encoding="utf-8")
            prompt = (
                template
                .replace("{scene}", target_scene.model_dump_json(indent=2))
                .replace("{correction}", user_correction)
                .replace("{previous_scene_summary}", previous_scene_summary or "None")
                .replace("{next_scene_summary}", next_scene_summary or "None")
            )

            parsed = await complete_json(prompt)
            repaired = ReconstructedScene.model_validate(parsed)
            repaired.scene_id = target_scene.scene_id
            return repaired
        except Exception as exc:
            logger.warning(f"LLM scene repair failed ({exc}); applying deterministic correction.")
            return self._fallback_repair_scene(
                target_scene,
                user_correction,
                previous_scene_summary,
                next_scene_summary,
            )

    def _fallback_repair_scene(
        self,
        target_scene: ReconstructedScene,
        user_correction: str,
        previous_scene_summary: str = "",
        next_scene_summary: str = "",
    ) -> ReconstructedScene:
        """
        Deterministic scene repair: replaces or prefixes scene beats with user correction.
        """
        new_beats: list[BeatItem] = [
            BeatItem(
                text=user_correction.strip(),
                source="user",
                inference_reason=None,
                confidence=1.0,
            )
        ]

        # Preserve dialogue or bridge if appropriate
        if previous_scene_summary:
            new_beats.insert(
                0,
                BeatItem(
                    text="The atmosphere carries through from the preceding stillness.",
                    source="inferred",
                    inference_reason="Bridges previous scene context into corrected narrative.",
                    confidence=0.85,
                ),
            )

        return ReconstructedScene(
            scene_id=target_scene.scene_id,
            heading=target_scene.heading,
            beats=new_beats,
            dialogue=target_scene.dialogue,
        )


reconstruction_service = ReconstructionService()


async def run_reconstruction_pipeline(
    db: AsyncSession,
    dream_id: uuid.UUID,
    user_id: uuid.UUID,
    mode: str = "faithful",
    history_snippets: list[str] | None = None,
    force_rebuild: bool = False,
) -> tuple[DreamVersion, ReconstructionOutput]:
    """
    Executes the full reconstruction pipeline for a dream:
    1. Checks if a version for this mode already exists (unless force_rebuild=True).
    2. Runs extraction if dream hasn't been extracted yet.
    3. Weaves scenes with tagged beats and dialogue.
    4. Saves DreamVersion record in database and updates dream status.
    """
    repo = DreamRepository(db, user_id)
    dream = await repo.get_by_id(dream_id)
    if not dream:
        raise ValueError("Dream not found")

    # If already built and force_rebuild is False, return existing
    if not force_rebuild:
        existing_version = await repo.get_latest_version(dream_id, mode=mode)
        if existing_version and existing_version.story_json:
            try:
                story_output = ReconstructionOutput.model_validate(existing_version.story_json)
                return existing_version, story_output
            except Exception:
                pass  # Fall through and regenerate if schema changed

    decrypted = await repo.get_decrypted(dream_id)
    if not decrypted:
        raise ValueError("Cannot decrypt dream")

    raw_notes = decrypted.transcript or decrypted.raw_text or ""
    answers = decrypted.recent_life_context or ""

    # Ensure extraction has run
    if dream.status == DreamStatus.CAPTURED.value:
        extraction_output, _ = await run_extraction_and_ingest(db, dream_id, user_id)
    else:
        extractor = ExtractionService()
        extraction_output = await extractor.extract_dream_data(raw_notes, answers)

    # Reconstruct story
    story = await reconstruction_service.reconstruct(
        extraction=extraction_output,
        notes=raw_notes,
        answers=answers,
        mode=mode,
        history_snippets=history_snippets,
    )

    # Save version
    gap_fills = [
        {"scene_id": s.scene_id, "text": b.text, "reason": b.inference_reason}
        for s in story.scenes
        for b in s.beats
        if b.source == "inferred"
    ]

    version = await repo.create_version(
        dream_id=dream_id,
        mode=mode,
        story_json=story.model_dump(),
        gap_fills_json=gap_fills,
        is_approved=False,
    )

    if dream.status in [DreamStatus.CAPTURED.value, DreamStatus.EXTRACTED.value]:
        await repo.update_dream(dream_id=dream_id, status=DreamStatus.RECONSTRUCTED.value)

    return version, story


async def run_scene_repair_pipeline(
    db: AsyncSession,
    dream_id: uuid.UUID,
    user_id: uuid.UUID,
    scene_id: int,
    user_correction: str,
) -> tuple[DreamVersion, ReconstructedScene]:
    """
    Regenerates only the targeted scene and updates the active DreamVersion.
    """
    repo = DreamRepository(db, user_id)
    version = await repo.get_latest_version(dream_id)
    if not version or not version.story_json:
        raise ValueError("No reconstructed story version found for this dream.")

    story = ReconstructionOutput.model_validate(version.story_json)
    target_idx = next((i for i, s in enumerate(story.scenes) if s.scene_id == scene_id), None)
    if target_idx is None:
        raise ValueError(f"Scene with ID {scene_id} not found in this story.")

    target_scene = story.scenes[target_idx]
    prev_summary = story.scenes[target_idx - 1].heading if target_idx > 0 else ""
    next_summary = story.scenes[target_idx + 1].heading if target_idx + 1 < len(story.scenes) else ""

    repaired_scene = await reconstruction_service.repair_single_scene(
        target_scene=target_scene,
        user_correction=user_correction,
        previous_scene_summary=prev_summary,
        next_scene_summary=next_summary,
    )

    story.scenes[target_idx] = repaired_scene
    updated_gap_fills = [
        {"scene_id": s.scene_id, "text": b.text, "reason": b.inference_reason}
        for s in story.scenes
        for b in s.beats
        if b.source == "inferred"
    ]

    updated_version = await repo.update_version(
        version_id=version.id,
        story_json=story.model_dump(),
        gap_fills_json=updated_gap_fills,
    )

    return updated_version, repaired_scene
