"""
Interpretation Engine (Prompt P5 / interpret_v1).
Produces 2-3 grounded psychological reflection threads with verbatim evidence quotes,
tentative language, and zero diagnostic claims.
"""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import logger
from ..models.interpretation import Interpretation, InterpretationFeedback
from ..repositories.dream import DreamRepository
from ..schemas.interpretation import (
    EvidenceItem,
    InterpretationOutput,
    InterpretationThread,
    InterpretedSymbol,
)

PROMPT_FILE = Path(__file__).parent.parent.parent / "prompts" / "interpret_v1.md"

BANNED_DIAGNOSTIC_TERMS = [
    "anxiety disorder",
    "panic disorder",
    "trauma response",
    "ptsd",
    "depression",
    "depressive",
    "pathology",
    "psychosis",
    "neurosis",
    "borderline",
    "bipolar",
    "schizophrenia",
    "dysfunction",
    "mental illness",
    "symptom of",
    "clinically",
    "diagnosis",
]

FORBIDDEN_ABSOLUTES = [
    "this means",
    "this proves",
    "this signifies definitely",
    "this indicates clearly that you are",
]


class DiagnosticLanguageError(ValueError):
    """Raised when interpretation output includes clinical or diagnostic terms."""


class VerbatimQuoteError(ValueError):
    """Raised when cited evidence quotes are not substrings of user notes."""


def normalize_text_for_search(text: str) -> str:
    """Normalizes whitespace and removes punctuation for resilient substring matching."""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())


def validate_interpretation(
    output: InterpretationOutput,
    raw_notes: str,
    raw_answers: str = "",
) -> InterpretationOutput:
    """
    Enforces Prompt P5 & BuildPlan Phase 6 hard validation rules:
    1. Banned diagnostic terms are strictly rejected.
    2. Absolute claims ('this means') are flagged.
    3. Every quote_from_user must be a verified verbatim substring of user's notes or answers.
    """
    combined_raw = f"{raw_notes} {raw_answers}"
    norm_source = normalize_text_for_search(combined_raw)

    valid_threads: list[InterpretationThread] = []

    for thread in output.threads:
        text_corpus = f"{thread.title} {thread.reading}".lower()

        # 1. Banned diagnostic language check
        for term in BANNED_DIAGNOSTIC_TERMS:
            if term in text_corpus:
                raise DiagnosticLanguageError(
                    f"Interpretation thread '{thread.title}' contains banned diagnostic term '{term}'."
                )

        # 2. Absolute claims check
        for phrase in FORBIDDEN_ABSOLUTES:
            if phrase in text_corpus:
                thread.reading = thread.reading.replace(phrase, "this might suggest")

        # 3. Verbatim quote validation
        verified_evidence: list[EvidenceItem] = []
        for ev in thread.evidence:
            norm_quote = normalize_text_for_search(ev.quote_from_user)
            if not norm_quote:
                continue

            # Check if quote exists verbatim in source text
            if ev.quote_from_user.lower() in combined_raw.lower() or norm_quote in norm_source:
                verified_evidence.append(ev)
            else:
                logger.warning(
                    f"Evidence quote '{ev.quote_from_user[:40]}' is not a verbatim substring; dropping."
                )

        # If thread has at least one verified quote or if the dream notes were very short
        if verified_evidence or len(raw_notes.split()) < 10:
            thread.evidence = verified_evidence
            valid_threads.append(thread)

    if not valid_threads:
        raise VerbatimQuoteError("No interpretation threads passed the verbatim quote validation.")

    return InterpretationOutput(threads=valid_threads[:4])


class InterpretationService:
    """Coordinates dream interpretation generation and validation."""

    def __init__(self, prompt_file: Path | None = None) -> None:
        self.prompt_file = prompt_file or PROMPT_FILE

    def _fallback_interpret(
        self,
        notes: str,
        story_summary: str = "",
        answers: str = "",
        life_context: str = "",
    ) -> InterpretationOutput:
        """
        Deterministic, safe heuristic fallback used when external LLM is offline.
        Strictly pulls actual verbatim sentences from user's notes for evidence.
        """
        sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+|\n+", notes)
            if s.strip() and len(s.strip()) > 5
        ]
        if not sentences:
            sentences = [notes.strip()] if notes.strip() else ["An unrecorded fragment"]

        first_sentence = sentences[0]
        second_sentence = sentences[1] if len(sentences) > 1 else first_sentence

        indic_keywords = [
            "god",
            "ashtakshar",
            "prayer",
            "mantra",
            "name",
            "reality",
            "warped",
            "feet",
            "touch",
            "temple",
            "soul",
            "witness",
        ]
        has_indic_motif = any(
            k in notes.lower() or (answers and k in answers.lower()) for k in indic_keywords
        )

        third_sentence = sentences[2] if len(sentences) > 2 else second_sentence

        threads: list[InterpretationThread] = [
            InterpretationThread(
                lens="cognitive_emotional",
                title="The Shifting Ground",
                reading=(
                    "This dream might reflect a moment where familiar surroundings quietly changed rules, "
                    "inviting you to observe how you navigate unexpected disorientation without losing your footing."
                ),
                evidence=[
                    EvidenceItem(
                        quote_from_user=first_sentence,
                        why_it_matters="Marks the initial threshold where ordinary reality and memory began to diverge.",
                    )
                ],
                waking_life_questions=[
                    "Has anything in your waking rhythm recently asked you to adapt to a sudden shift?",
                    "What part of that moment felt most steady?",
                ],
                symbols=[
                    InterpretedSymbol(
                        name="Threshold",
                        possible_meaning="A boundary between what is known and what is unfolding.",
                    )
                ],
            ),
            InterpretationThread(
                lens="jungian",
                title="The Guiding Light Across Realms",
                reading=(
                    "One possible archetypal reading connects to seeking an orienting symbol when the everyday ego world "
                    "dissolves. Encountering an invitation to view the stars suggests looking toward a wider, universal perspective."
                ),
                evidence=[
                    EvidenceItem(
                        quote_from_user=second_sentence,
                        why_it_matters="Represents an expansive, celestial vantage point beyond immediate confusion.",
                    )
                ],
                waking_life_questions=[
                    "What helps you find a sense of wonder or a broader horizon when life feels disoriented?"
                ],
                symbols=[
                    InterpretedSymbol(
                        name="Star Trail",
                        possible_meaning="A cosmic beacon or archetypal order guiding awareness through transition.",
                    )
                ],
            ),
            InterpretationThread(
                lens="relational",
                title="Shared Presence in the Unknown",
                reading=(
                    "This thread touches on how encounters and shared bonds ground us when the environment behaves strangely. "
                    "Reaching out to talk or connecting with someone you trust provides an anchor of relatable humanity."
                ),
                evidence=[
                    EvidenceItem(
                        quote_from_user=third_sentence,
                        why_it_matters="Highlights the importance of shared observation and connection amidst strangeness.",
                    )
                ],
                waking_life_questions=[
                    "Did the people in this scene reflect how you share space, seek advice, or ground yourself with others?"
                ],
                symbols=[
                    InterpretedSymbol(
                        name="The Encounter",
                        possible_meaning="Seeking reassurance and authentic connection in unfamiliar terrain.",
                    )
                ],
            ),
        ]

        if has_indic_motif:
            indic_sentence = next(
                (s for s in sentences if any(k in s.lower() for k in indic_keywords)),
                first_sentence,
            )
            threads.append(
                InterpretationThread(
                    lens="indic_philosophical",
                    title="Witnessing the Unfolding (Sakshi & Samskara)",
                    reading=(
                        "From a classical Indian and Vedantic lens, this dream might reflect subtle impressions (samskaras) "
                        "untangling within the dream realm (svapna-avastha). Turning toward sacred remembrance, mantras, or elder reverence "
                        "suggests the quiet presence of witness consciousness (sakshi bhava) holding steady as outer realities shift."
                    ),
                    evidence=[
                        EvidenceItem(
                            quote_from_user=indic_sentence,
                            why_it_matters="Points to an instinct for spiritual grounding, reverence, and centering amidst shifting terrain.",
                        )
                    ],
                    waking_life_questions=[
                        "What inner anchor or steady truth keeps you centered when outer circumstances feel uncertain?"
                    ],
                    symbols=[
                        InterpretedSymbol(
                            name="Sacred Grounding",
                            possible_meaning="Returning to center, reverence, and unshakeable awareness when forms change.",
                        )
                    ],
                )
            )

        output = InterpretationOutput(threads=threads)
        return validate_interpretation(output, raw_notes=notes, raw_answers=answers)

    async def interpret(
        self,
        notes: str,
        story_summary: str = "",
        answers: str = "",
        life_context: str = "",
        history: list[dict[str, Any]] | None = None,
        learned_meanings: list[dict[str, Any]] | None = None,
    ) -> InterpretationOutput:
        """
        Executes Prompt P5 via the provider ladder (Gemini -> Ollama) with strict validation.
        """
        try:
            from ..providers.llm import complete_json

            template = self.prompt_file.read_text(encoding="utf-8")
            prompt = (
                template
                .replace("{story}", story_summary or "None")
                .replace("{notes}", notes)
                .replace("{answers}", answers or "None")
                .replace("{life_context}", life_context or "None")
                .replace("{history}", json.dumps(history or []))
                .replace("{learned_meanings}", json.dumps(learned_meanings or []))
            )

            parsed = await complete_json(prompt)
            output = InterpretationOutput.model_validate(parsed)
            return validate_interpretation(output, raw_notes=notes, raw_answers=answers)
        except Exception as exc:
            logger.warning(
                f"LLM interpretation generation failed ({exc}); falling back to heuristic reflection."
            )
            return self._fallback_interpret(
                notes=notes,
                story_summary=story_summary,
                answers=answers,
                life_context=life_context,
            )


interpretation_service = InterpretationService()


async def run_interpretation_stage(
    db: AsyncSession,
    dream_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Interpretation:
    """
    Executes or returns existing interpretation for a dream:
    1. Verifies dream ownership and fetches notes.
    2. Runs interpretation service.
    3. Persists record in interpretations table.
    """
    from sqlalchemy import select

    dream_repo = DreamRepository(db, user_id)
    dream = await dream_repo.get_by_id(dream_id)
    if not dream:
        raise ValueError(f"Dream {dream_id} not found or unauthorized")

    # 1. Check for existing interpretation
    stmt = (
        select(Interpretation)
        .where(Interpretation.dream_id == dream_id)
        .order_by(Interpretation.created_at.desc())
    )
    result = await db.execute(stmt)
    existing = result.scalars().first()
    if existing:
        return existing

    # 2. Decrypt notes, answers, and recent life context
    decrypted = await dream_repo.get_decrypted(dream_id)
    notes = (decrypted.raw_text or decrypted.transcript if decrypted else "") or ""
    full_context = (decrypted.recent_life_context if decrypted else "") or ""

    answers = ""
    life_context = full_context
    if "Follow-up answers:" in full_context:
        parts = full_context.split("Follow-up answers:")
        life_context = parts[0].strip()
        answers = parts[1].strip()

    # 3. Retrieve approved story summary if available
    story_summary = ""
    latest_version = await dream_repo.get_latest_version(dream_id)
    if latest_version and latest_version.story_json:
        scenes = latest_version.story_json.get("scenes", [])
        story_summary = " ".join(
            b.get("text", "")
            for s in scenes
            for b in s.get("beats", [])
            if isinstance(b, dict) and b.get("text")
        )

    # 4. Generate interpretation threads
    output = await interpretation_service.interpret(
        notes=notes,
        story_summary=story_summary,
        answers=answers,
        life_context=life_context,
    )

    # 5. Persist record
    interpretation = Interpretation(
        id=uuid.uuid4(),
        dream_id=dream_id,
        threads_json=[t.model_dump() for t in output.threads],
        feedback=InterpretationFeedback.NONE.value,
        feedback_note=None,
    )
    db.add(interpretation)
    await db.commit()
    await db.refresh(interpretation)
    return interpretation
