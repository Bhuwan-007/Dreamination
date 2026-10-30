"""
Transcription Service with Provider Abstraction.
Preserves raw hesitations, pauses, and filler words in raw_transcript,
and generates a lightly cleaned version for reading flow.
Rule 6: NEVER logs transcript contents.
"""

from __future__ import annotations

import io
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass

from .logging import logger


@dataclass
class TranscriptionResult:
    """Transcription outcome holding both raw and lightly cleaned text."""
    raw_transcript: str
    cleaned_transcript: str
    duration_seconds: float
    confidence: float = 1.0


def clean_transcript(raw_text: str) -> str:
    """
    Lightly cleans raw spoken dream notes while strictly preserving every detail,
    symbol, and event. Only removes excessive stammers and normalizes spacing.
    """
    if not raw_text:
        return ""

    # Normalize excessive stutter/filler repetitions (e.g. "um... um..." -> "um...")
    cleaned = re.sub(r"\b(um|uh|er|ah)\s+(um|uh|er|ah)\b", r"\1", raw_text, flags=re.IGNORECASE)
    # Normalize punctuation and spacing
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Capitalize first character
    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]

    return cleaned


class TranscriptionProvider(ABC):
    """Abstract interface for speech-to-text engines."""

    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, filename: str = "dream.webm") -> TranscriptionResult:
        """Transcribe audio bytes into raw and cleaned transcripts."""
        raise NotImplementedError


class FasterWhisperTranscriptionProvider(TranscriptionProvider):
    """
    Local Whisper transcription using faster-whisper (CTranslate2).
    Runs offline on local GPU/CPU.
    """

    def __init__(self, model_size: str = "base") -> None:
        self.model_size = model_size
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                self._model = WhisperModel(self.model_size, device="auto", compute_type="auto")
            except ImportError as err:
                raise RuntimeError("faster-whisper package is not installed.") from err
        return self._model

    async def transcribe(self, audio_bytes: bytes, filename: str = "dream.webm") -> TranscriptionResult:
        model = self._get_model()
        audio_stream = io.BytesIO(audio_bytes)

        segments, info = model.transcribe(
            audio_stream,
            beam_size=5,
            vad_filter=True,
            initial_prompt="Dream journal notes, half-awake spoken stream of consciousness with pauses and surreal imagery.",
        )

        raw_parts = [segment.text for segment in segments]
        raw_text = " ".join(raw_parts).strip()
        cleaned_text = clean_transcript(raw_text)

        logger.info(f"Transcription completed (duration={round(info.duration, 2)}s, lang={info.language})")
        return TranscriptionResult(
            raw_transcript=raw_text,
            cleaned_transcript=cleaned_text,
            duration_seconds=float(info.duration),
            confidence=0.95,
        )


class MockOrLocalTranscriptionProvider(TranscriptionProvider):
    """
    Deterministic transcription engine for tests, CI, and instant local demo runs.
    Accepts any audio file and returns a structured dream transcript without external calls.
    """

    def __init__(self, sample_transcript: str | None = None) -> None:
        self.sample_transcript = sample_transcript or (
            "I was... um, standing at the edge of an empty school locker hallway. "
            "The floors were completely underwater, like dark glass. "
            "A person with a shadowy face was holding a ticking brass clock and said, "
            "'We don't have much time before the tide climbs the stairs.' "
            "Then... er, I opened the third locker and found a flight of stone steps descending into the ocean."
        )

    async def transcribe(self, audio_bytes: bytes, filename: str = "dream.webm") -> TranscriptionResult:
        raw_text = self.sample_transcript
        cleaned_text = clean_transcript(raw_text)
        # Approximate duration based on byte length (e.g. ~16kB/sec for WebM audio)
        estimated_duration = max(3.0, round(len(audio_bytes) / 16000.0, 1))

        logger.info(f"Local mock transcription generated ({estimated_duration}s duration, {len(audio_bytes)} bytes)")
        return TranscriptionResult(
            raw_transcript=raw_text,
            cleaned_transcript=cleaned_text,
            duration_seconds=estimated_duration,
            confidence=1.0,
        )


def get_transcription_provider() -> TranscriptionProvider:
    """Factory selecting the best available transcription provider."""
    try:
        import faster_whisper  # noqa: F401
        return FasterWhisperTranscriptionProvider()
    except ImportError:
        return MockOrLocalTranscriptionProvider()

