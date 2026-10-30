"""
Dreams API router:
- POST   /dreams                  (Create dream, optional audio transcription)
- POST   /dreams/upload-audio     (Upload raw audio blob and transcribe)
- GET    /dreams                  (List user's dreams)
- GET    /dreams/{id}             (Get decrypted dream details)
- POST   /dreams/{id}/followups   (Generate follow-up questions)
- POST   /dreams/{id}/answers     (Store answers to follow-up questions)
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..followups import FollowupQuestion, FollowupResponse, generate_followup_questions
from ..models.dream import DreamStatus
from ..models.user import User
from ..repositories.dream import DreamRepository
from ..schemas.extraction import ExtractionOutput
from ..stages.extract import run_extraction_and_ingest
from ..storage import storage_service
from ..transcription import get_transcription_provider

router = APIRouter(prefix="/dreams", tags=["dreams"])


class CreateDreamRequest(BaseModel):
    raw_text: str | None = None
    mood_on_waking: str | None = None
    recent_life_context: str | None = None
    raw_audio_key: str | None = None
    transcript: str | None = None


class DreamResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    captured_at: datetime
    raw_text: str | None
    transcript: str | None
    mood_on_waking: str | None
    recent_life_context: str | None
    raw_audio_key: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class DreamSummaryResponse(BaseModel):
    id: uuid.UUID
    captured_at: datetime
    mood_on_waking: str | None
    status: str
    has_audio: bool
    created_at: datetime


class FollowupAnswerItem(BaseModel):
    question_id: str
    question_text: str
    answer: str


class SubmitAnswersRequest(BaseModel):
    answers: list[FollowupAnswerItem]


class AudioUploadResponse(BaseModel):
    storage_key: str
    raw_transcript: str
    cleaned_transcript: str
    duration_seconds: float


@router.post("/upload-audio", response_model=AudioUploadResponse)
async def upload_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> AudioUploadResponse:
    """
    Uploads raw audio stream (WebM/WAV) from dream capture,
    stores in storage, and runs Whisper transcription.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio file provided.")

    storage_key = storage_service.save_audio(audio_bytes, file.filename or "dream.webm")

    # Transcribe speech
    provider = get_transcription_provider()
    result = await provider.transcribe(audio_bytes, file.filename or "dream.webm")

    return AudioUploadResponse(
        storage_key=storage_key,
        raw_transcript=result.raw_transcript,
        cleaned_transcript=result.cleaned_transcript,
        duration_seconds=result.duration_seconds,
    )


@router.post("", response_model=DreamResponse, status_code=status.HTTP_201_CREATED)
async def create_dream(
    req: CreateDreamRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DreamResponse:
    """
    Creates a new dream entry in status 'captured'.
    Encrypts dream text at the application layer before saving to database.
    """
    repo = DreamRepository(db, current_user.id)

    dream = await repo.create_dream(
        raw_text=req.raw_text,
        transcript=req.transcript,
        mood_on_waking=req.mood_on_waking,
        recent_life_context=req.recent_life_context,
        raw_audio_key=req.raw_audio_key,
        status=DreamStatus.CAPTURED.value,
    )

    decrypted = await repo.get_decrypted(dream.id)
    if not decrypted:
        raise HTTPException(status_code=500, detail="Failed to retrieve newly created dream.")

    return DreamResponse(
        id=decrypted.id,
        user_id=decrypted.user_id,
        captured_at=decrypted.captured_at,
        raw_text=decrypted.raw_text,
        transcript=decrypted.transcript,
        mood_on_waking=decrypted.mood_on_waking,
        recent_life_context=decrypted.recent_life_context,
        raw_audio_key=decrypted.raw_audio_key,
        status=decrypted.status,
        created_at=decrypted.created_at,
        updated_at=decrypted.updated_at,
    )


@router.get("", response_model=list[DreamSummaryResponse])
async def list_dreams(
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DreamSummaryResponse]:
    """Lists dreams belonging strictly to the authenticated user."""
    repo = DreamRepository(db, current_user.id)
    records = await repo.list(offset=offset, limit=limit)

    return [
        DreamSummaryResponse(
            id=d.id,
            captured_at=d.captured_at,
            mood_on_waking=d.mood_on_waking,
            status=d.status,
            has_audio=bool(d.raw_audio_key),
            created_at=d.created_at,
        )
        for d in records
    ]


@router.get("/{dream_id}", response_model=DreamResponse)
async def get_dream(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DreamResponse:
    """Returns decrypted dream details strictly for the owner."""
    repo = DreamRepository(db, current_user.id)
    decrypted = await repo.get_decrypted(dream_id)
    if not decrypted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    return DreamResponse(
        id=decrypted.id,
        user_id=decrypted.user_id,
        captured_at=decrypted.captured_at,
        raw_text=decrypted.raw_text,
        transcript=decrypted.transcript,
        mood_on_waking=decrypted.mood_on_waking,
        recent_life_context=decrypted.recent_life_context,
        raw_audio_key=decrypted.raw_audio_key,
        status=decrypted.status,
        created_at=decrypted.created_at,
        updated_at=decrypted.updated_at,
    )


@router.post("/{dream_id}/followups", response_model=FollowupResponse)
async def get_followup_questions(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FollowupResponse:
    """
    Generates 2 to 3 gentle, sensory follow-up questions from the dream text.
    """
    repo = DreamRepository(db, current_user.id)
    decrypted = await repo.get_decrypted(dream_id)
    if not decrypted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    source_text = decrypted.transcript or decrypted.raw_text or ""
    questions = await generate_followup_questions(source_text)
    return FollowupResponse(questions=questions)


@router.post("/{dream_id}/answers", response_model=DreamResponse)
async def submit_answers(
    dream_id: uuid.UUID,
    req: SubmitAnswersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DreamResponse:
    """
    Appends answers to follow-up questions into the dream's encrypted context.
    """
    repo = DreamRepository(db, current_user.id)
    decrypted = await repo.get_decrypted(dream_id)
    if not decrypted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    existing_context = decrypted.recent_life_context or ""
    answers_formatted = "\n".join(
        f"[Q: {item.question_text}] -> {item.answer}" for item in req.answers if item.answer.strip()
    )

    updated_context = f"{existing_context}\n\nFollow-up answers:\n{answers_formatted}".strip()

    await repo.update_dream(
        dream_id=dream_id,
        recent_life_context=updated_context,
    )

    new_decrypted = await repo.get_decrypted(dream_id)
    return DreamResponse(
        id=new_decrypted.id,
        user_id=new_decrypted.user_id,
        captured_at=new_decrypted.captured_at,
        raw_text=new_decrypted.raw_text,
        transcript=new_decrypted.transcript,
        mood_on_waking=new_decrypted.mood_on_waking,
        recent_life_context=new_decrypted.recent_life_context,
        raw_audio_key=new_decrypted.raw_audio_key,
        status=new_decrypted.status,
        created_at=new_decrypted.created_at,
        updated_at=new_decrypted.updated_at,
    )


class ExtractDreamResponse(BaseModel):
    dream_id: uuid.UUID
    status: str
    extraction: ExtractionOutput
    resolved_entities_count: int


@router.post("/{dream_id}/extract", response_model=ExtractDreamResponse)
async def extract_dream(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExtractDreamResponse:
    """
    Executes the Extraction stage on a captured dream:
    Extracts faithful fragments, entities, emotions, and transitions,
    resolves recurring entities against the user's graph, and links co-occurrence edges.
    """
    repo = DreamRepository(db, current_user.id)
    decrypted = await repo.get_decrypted(dream_id)
    if not decrypted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    try:
        extraction_output, resolved_entities = await run_extraction_and_ingest(
            db=db,
            dream_id=dream_id,
            user_id=current_user.id,
        )
        return ExtractDreamResponse(
            dream_id=dream_id,
            status=DreamStatus.EXTRACTED.value,
            extraction=extraction_output,
            resolved_entities_count=len(resolved_entities),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(exc)}",
        ) from exc

