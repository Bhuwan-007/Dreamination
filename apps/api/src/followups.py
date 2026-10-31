"""
Follow-up Question Generation Engine (Prompt P1 / followups_v1).
Generates at most 3 gentle, sensory/emotional questions to resolve ambiguity.
Never suggests answers, never leads, and never asks about waking life.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field

from .logging import logger

PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "followups_v1.md"


class FollowupQuestion(BaseModel):
    id: str = Field(description="Unique identifier for question, e.g. q1")
    text: str = Field(description="Gentle, sensory question inquiring about feeling or atmosphere")
    targets: str = Field(
        default="sensation",
        description="Target category (emotion, sensation, character, transition, ending)",
    )


class FollowupResponse(BaseModel):
    questions: list[FollowupQuestion]


def _generate_fallback_questions(dream_text: str) -> list[FollowupQuestion]:
    """
    Heuristic sensory question generator used when external LLM keys are absent.
    Respects all prompt rules: prioritizes emotion & sensation, never leads, max 3.
    """
    lower = dream_text.lower()
    questions: list[FollowupQuestion] = []

    # 1. Check for atmosphere / sensation
    has_sensory = any(w in lower for w in ["cold", "warm", "air", "sound", "wind", "smell", "scent", "light", "heavy"])
    if not has_sensory:
        questions.append(
            FollowupQuestion(
                id="q1",
                text="What did the air feel like around you — heavy, cool, or weightless?",
                targets="sensation",
            )
        )

    # 2. Check for emotional valence
    has_emotion = any(w in lower for w in ["scared", "fear", "happy", "calm", "sad", "anxious", "curious", "relief", "wonder"])
    if not has_emotion:
        questions.append(
            FollowupQuestion(
                id="q2",
                text="In that central moment, were you frightened, or just quietly watching?",
                targets="emotion",
            )
        )

    # 3. Check for transitions / endings
    has_ending = any(w in lower for w in ["woke up", "waking", "ended", "disappeared", "vanished", "fade"])
    if not has_ending and len(questions) < 3:
        questions.append(
            FollowupQuestion(
                id="q3",
                text="How did the dream leave you when it let go?",
                targets="ending",
            )
        )

    return questions[:3]


async def generate_followup_questions(dream_text: str) -> list[FollowupQuestion]:
    """
    Generates 0 to 3 gentle, non-leading follow-up questions from dream notes.
    Uses LLM ladder (Gemini -> Ollama) with deterministic sensory fallback.
    """
    if not dream_text or len(dream_text.strip()) < 15:
        return [
            FollowupQuestion(
                id="q1",
                text="Do you remember any small detail — a color, a temperature, or a sound?",
                targets="sensation",
            )
        ]

    try:
        from .providers.llm import complete_json

        template = PROMPT_FILE.read_text(encoding="utf-8")
        prompt = template.replace("{notes}", dream_text)
        parsed = await complete_json(prompt)
        res = FollowupResponse.model_validate(parsed)
        return res.questions[:3]
    except Exception as exc:
        logger.info(f"LLM follow-up generation failed ({exc}); falling back to heuristic questions.")
        return _generate_fallback_questions(dream_text)

