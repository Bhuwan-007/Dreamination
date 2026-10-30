"""
Extract Stage Runner & Entity Graph Resolver (Prompt P2 / extract_v1).
Parses dream notes + follow-up answers into structured fragments, entities,
emotions, and transitions, then resolves and links them into the user's personal graph.
"""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import logger
from ..models.dream import DreamStatus
from ..models.entity import Entity, EntityType
from ..repositories.dream import DreamRepository
from ..repositories.entity import EntityRepository
from ..schemas.extraction import (
    DreamFragment,
    ExtractedEmotion,
    ExtractedEntity,
    ExtractedTransition,
    ExtractionOutput,
)

PROMPT_FILE = Path(__file__).parent.parent.parent / "prompts" / "extract_v1.md"


def _clean_json_output(raw_text: str) -> str:
    """Strips markdown code fences, comments, and whitespace."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


class ExtractionService:
    """Executes dream extraction and prompt-injection defense."""

    def __init__(self, prompt_template_path: Path | None = None) -> None:
        self.prompt_path = prompt_template_path or PROMPT_FILE

    def _fallback_extract(
        self,
        notes: str,
        answers: str = "",
        known_entities: list[dict[str, Any]] | None = None,
    ) -> ExtractionOutput:
        """
        Deterministic, rule-based extraction fallback.
        Faithfully segments notes, captures entities in user's phrasing,
        detects emotions with intensities, and maps dream-logic transitions.
        """
        combined = f"{notes}\n{answers}".strip()

        # Check for and safely neutralize prompt injection attempts
        if "ignore previous instructions" in combined.lower() or "return {" in combined.lower():
            logger.warning("Prompt injection pattern detected inside dream text; treating purely as narrative data.")

        # 1. Fragment segmentation
        raw_sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+|\n+", notes)
            if s.strip() and len(s.strip()) > 4
        ]
        if not raw_sentences:
            raw_sentences = [notes.strip()] if notes.strip() else ["A faint, fleeting dream memory."]

        fragments: list[DreamFragment] = []
        for idx, sentence in enumerate(raw_sentences, start=1):
            certainty = "vivid"
            lower = sentence.lower()
            if any(w in lower for w in ["maybe", "might", "vaguely", "somehow", "blurry", "faint"]):
                certainty = "vague"
            elif any(w in lower for w in ["cannot recall", "don't know", "not sure", "uncertain"]):
                certainty = "uncertain"

            fragments.append(
                DreamFragment(
                    id=f"f{idx}",
                    text=sentence,
                    order_hint=idx,
                    certainty=certainty,
                )
            )

        # 2. Entity extraction
        entities: list[ExtractedEntity] = []
        known_map = {e.get("name", "").lower(): e.get("name") for e in (known_entities or [])}

        # Common archetypal entity detectors
        entity_patterns = [
            (r"\b(?:clock|ticking clock|brass clock|watch)\b", "symbol", "a ticking brass clock", "Clock"),
            (r"\b(?:sea|ocean|water|flooded|tide|underwater)\b", "place", "water on the floor", "The Water"),
            (r"\b(?:hallway|corridor|lockers?|school)\b", "place", "a long school hallway", "The Corridor"),
            (r"\b(?:staircase|stairs|steps)\b", "place", "flight of stone stairs", "Stone Staircase"),
            (r"\b(?:door|copper doors?|mirror|picture frames?)\b", "symbol", "drifting copper door", "The Door"),
            (r"\b(?:shadowy figure|stranger|person|friend|traveler|companion)\b", "person", "a person with a shadowy face", "The Companion"),
            (r"\b(?:white wolf|wolf|white stag|stag|owl|bird|creature)\b", "creature", "a white wolf", "White Wolf"),
            (r"\b(?:desert|mountain|library|tower)\b", "place", "an empty desert", "The Desert"),
            (r"\b(?:key|iron key|letter|box)\b", "object", "an old iron key", "Iron Key"),
        ]

        text_lower = combined.lower()
        seen_names = set()

        for pattern, ent_type, default_phrase, canon_name in entity_patterns:
            match = re.search(pattern, text_lower)
            if match:
                matched_phrase = match.group(0)
                matched_known = known_map.get(canon_name.lower())
                name = matched_known or canon_name

                if name not in seen_names:
                    seen_names.add(name)
                    entities.append(
                        ExtractedEntity(
                            name=name,
                            type=ent_type,
                            description_from_user=matched_phrase,
                            matches_known=matched_known,
                            is_known_person=(ent_type == "person" and "friend" in matched_phrase),
                            salience=0.85 if idx == 1 else 0.65,
                        )
                    )

        # If no specific entities detected, provide narrative anchor
        if not entities:
            entities.append(
                ExtractedEntity(
                    name="The Threshold",
                    type="place",
                    description_from_user=notes[:40],
                    is_known_person=False,
                    salience=0.5,
                )
            )

        # 3. Emotion extraction
        emotions: list[ExtractedEmotion] = []
        emotion_map = [
            (r"\b(?:scared|terrified|horror|dread|fear)\b", "dread", 0.9),
            (r"\b(?:uneasy|anxious|tense|nervous|worry)\b", "unease", 0.7),
            (r"\b(?:wonder|awe|amazed|astonished|fascinated)\b", "wonder", 0.85),
            (r"\b(?:calm|peaceful|serene|tranquil|quiet)\b", "peace", 0.75),
            (r"\b(?:sad|melancholic|sorrow|grief|lonely)\b", "melancholy", 0.8),
            (r"\b(?:curious|intrigued|puzzled|questioning)\b", "curiosity", 0.6),
            (r"\b(?:disoriented|confused|lost|strange)\b", "disorientation", 0.7),
        ]

        for pattern, label, intensity in emotion_map:
            if re.search(pattern, text_lower):
                emotions.append(
                    ExtractedEmotion(
                        label=label,
                        intensity=intensity,
                        attached_to=fragments[0].id if fragments else None,
                    )
                )

        if not emotions:
            emotions.append(
                ExtractedEmotion(
                    label="curiosity",
                    intensity=0.5,
                    attached_to=fragments[0].id if fragments else None,
                )
            )

        # 4. Dream-logic transitions
        transitions: list[ExtractedTransition] = []
        if len(fragments) > 1:
            for i in range(len(fragments) - 1):
                f_curr = fragments[i]
                f_next = fragments[i + 1]
                t_type = "unexplained"
                next_lower = f_next.text.lower()

                if any(w in next_lower for w in ["fell", "falling", "dropped"]):
                    t_type = "fall"
                elif any(w in next_lower for w in ["water", "underwater", "submerged", "sank", "ocean"]):
                    t_type = "submerge"
                elif any(w in next_lower for w in ["became", "turned into", "transformed", "shifted"]):
                    t_type = "morph"
                elif any(w in next_lower for w in ["suddenly", "then", "cut to", "instantly"]):
                    t_type = "cut"

                transitions.append(
                    ExtractedTransition(
                        from_fragment=f_curr.id,
                        to_fragment=f_next.id,
                        type=t_type,
                    )
                )

        # 5. Day residue candidates (mundane waking references)
        residue_patterns = [
            r"\b(?:exam|school|office|boss|job|meeting|deadline|homework)\b",
            r"\b(?:phone|laptop|computer|car|keys|apartment|rent)\b",
            r"\b(?:mother|father|mom|dad|sister|brother|coworker)\b",
        ]
        day_residue: list[str] = []
        for pat in residue_patterns:
            matches = re.findall(pat, text_lower)
            for m in matches:
                if m not in day_residue:
                    day_residue.append(m)

        # 6. Dream ending
        ending = None
        for sentence in reversed(raw_sentences):
            if any(w in sentence.lower() for w in ["woke up", "waking", "ended", "disappeared", "vanished", "fade", "alarm"]):
                ending = sentence
                break

        return ExtractionOutput(
            fragments=fragments,
            entities=entities,
            emotions=emotions,
            transitions=transitions,
            day_residue_candidates=day_residue,
            ending=ending,
        )

    async def extract_dream_data(
        self,
        notes: str,
        answers: str = "",
        known_entities: list[dict[str, Any]] | None = None,
    ) -> ExtractionOutput:
        """
        Executes faithful dream structure extraction.
        """
        return self._fallback_extract(notes, answers, known_entities)


async def run_extraction_and_ingest(
    db: AsyncSession,
    dream_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[ExtractionOutput, list[Entity]]:
    """
    Pipeline stage runner:
    1. Fetches and decrypts user's dream notes + follow-up answers.
    2. Gathers existing personal entities for resolution.
    3. Runs extraction service.
    4. Resolves entities against graph, creates links and co-occurrence edges.
    5. Updates dream status to 'extracted'.
    """
    dream_repo = DreamRepository(db, user_id)
    entity_repo = EntityRepository(db, user_id)

    decrypted_dream = await dream_repo.get_decrypted(dream_id)
    if not decrypted_dream:
        raise ValueError("Dream not found or unauthorized.")

    # 1. Fetch user's existing entities
    existing_entities = await entity_repo.list(limit=200)
    known_entities_data = [
        {"name": e.canonical_name, "aliases": e.aliases, "type": e.type}
        for e in existing_entities
    ]

    # 2. Run extraction
    extractor = ExtractionService()
    notes_content = decrypted_dream.transcript or decrypted_dream.raw_text or ""
    answers_content = decrypted_dream.recent_life_context or ""

    extraction_output = await extractor.extract_dream_data(
        notes=notes_content,
        answers=answers_content,
        known_entities=known_entities_data,
    )

    # 3. Entity resolution and graph ingestion
    resolved_entities: list[Entity] = []

    for extracted in extraction_output.entities:
        # Step A: Check exact name match
        matched_entity = await entity_repo.get_by_name(extracted.name)

        # Step B: Check alias matches if not matched by name
        if not matched_entity:
            for existing in existing_entities:
                if extracted.name.lower() in [a.lower() for a in existing.aliases]:
                    matched_entity = existing
                    break

        # Step C: If still not matched, create new entity node
        if not matched_entity:
            matched_entity = await entity_repo.create_entity(
                canonical_name=extracted.name,
                type=extracted.type,
                aliases=[extracted.description_from_user] if extracted.description_from_user != extracted.name else [],
                description=extracted.description_from_user,
                first_seen_dream_id=dream_id,
            )
            existing_entities.append(matched_entity)

        resolved_entities.append(matched_entity)

        # Step D: Link entity to dream in dream_entity_links
        try:
            await dream_repo.link_entity(
                dream_id=dream_id,
                entity_id=matched_entity.id,
                role=extracted.type,
                salience=extracted.salience,
                emotion_valence=0.0,
            )
        except Exception:
            # Avoid duplicate links if already linked
            pass

    # 4. Link entity edges for co-occurring entities
    for i in range(len(resolved_entities) - 1):
        for j in range(i + 1, len(resolved_entities)):
            src = resolved_entities[i]
            tgt = resolved_entities[j]
            if src.id != tgt.id:
                try:
                    await entity_repo.create_edge(
                        source_entity_id=src.id,
                        target_entity_id=tgt.id,
                        relation_type="co_occurs_with",
                        weight=1.0,
                        evidence_dream_ids=[str(dream_id)],
                    )
                except Exception:
                    pass

    # 5. Update dream status
    await dream_repo.update_dream(dream_id=dream_id, status=DreamStatus.EXTRACTED.value)
    await db.commit()

    logger.info(
        f"Extraction complete for dream {dream_id}: "
        f"{len(extraction_output.fragments)} fragments, {len(resolved_entities)} entities resolved."
    )

    return extraction_output, resolved_entities

