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

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..followups import FollowupResponse, generate_followup_questions
from ..models.dream import DreamStatus
from ..models.interpretation import Interpretation
from ..models.user import User
from ..repositories.dream import DreamRepository
from ..schemas.extraction import ExtractionOutput
from ..schemas.interpretation import (
    InterpretationFeedbackRequest,
    InterpretationResponse,
    InterpretationThread,
)
from ..schemas.reconstruction import (
    ApproveDreamRequest,
    ApproveDreamResponse,
    DreamVersionResponse,
    ReconstructDreamRequest,
    ReconstructedScene,
    ReconstructionOutput,
    SceneRepairRequest,
)
from ..stages.extract import run_extraction_and_ingest
from ..stages.interpret import run_interpretation_stage
from ..stages.reconstruct import (
    run_reconstruction_pipeline,
    run_scene_repair_pipeline,
)
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


@router.delete("/{dream_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_dream(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Deletes a dream and all cascaded versions, interpretations, and entity links."""
    repo = DreamRepository(db, current_user.id)
    deleted = await repo.delete(dream_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
            detail=f"Extraction failed: {exc!s}",
        ) from exc


# --- Reconstruction & Review Endpoints (Prompt P3 & P4) ---

@router.post("/{dream_id}/reconstruct", response_model=DreamVersionResponse)
async def reconstruct_dream(
    dream_id: uuid.UUID,
    payload: ReconstructDreamRequest = ReconstructDreamRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DreamVersionResponse:
    """
    Reconstructs the dream into a 5-8 scene story in 'faithful' or 'authored' mode.
    Every inferred sentence is tagged with confidence and an inference reason.
    """
    repo = DreamRepository(db, current_user.id)
    dream = await repo.get_by_id(dream_id)
    if not dream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    try:
        version, story = await run_reconstruction_pipeline(
            db=db,
            dream_id=dream_id,
            user_id=current_user.id,
            mode=payload.mode,
            history_snippets=payload.history_snippets,
            force_rebuild=payload.force_rebuild,
        )
        return DreamVersionResponse(
            id=version.id,
            dream_id=version.dream_id,
            mode=version.mode,
            story=story,
            is_approved=version.is_approved,
            created_at=version.created_at,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reconstruction failed: {exc!s}",
        ) from exc


@router.get("/{dream_id}/versions", response_model=list[DreamVersionResponse])
async def list_dream_versions(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DreamVersionResponse]:
    """Lists all reconstructed story versions for this dream."""
    repo = DreamRepository(db, current_user.id)
    try:
        versions = await repo.list_versions(dream_id)
        result: list[DreamVersionResponse] = []
        for v in versions:
            story = ReconstructionOutput.model_validate(v.story_json)
            result.append(
                DreamVersionResponse(
                    id=v.id,
                    dream_id=v.dream_id,
                    mode=v.mode,
                    story=story,
                    is_approved=v.is_approved,
                    created_at=v.created_at,
                )
            )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to fetch versions: {exc!s}",
        ) from exc


class SceneRepairResponse(BaseModel):
    version_id: uuid.UUID
    scene: ReconstructedScene


@router.patch("/{dream_id}/scenes/{scene_id}", response_model=SceneRepairResponse)
async def repair_scene(
    dream_id: uuid.UUID,
    scene_id: int,
    payload: SceneRepairRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SceneRepairResponse:
    """
    Regenerates ONLY the single targeted scene using the user's correction
    as ground truth, maintaining emotional continuity with neighboring scenes.
    """
    repo = DreamRepository(db, current_user.id)
    dream = await repo.get_by_id(dream_id)
    if not dream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    try:
        updated_version, repaired_scene = await run_scene_repair_pipeline(
            db=db,
            dream_id=dream_id,
            user_id=current_user.id,
            scene_id=scene_id,
            user_correction=payload.correction,
        )
        return SceneRepairResponse(
            version_id=updated_version.id,
            scene=repaired_scene,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scene repair failed: {exc!s}",
        ) from exc


@router.post("/{dream_id}/approve", response_model=ApproveDreamResponse)
async def approve_dream(
    dream_id: uuid.UUID,
    payload: ApproveDreamRequest = ApproveDreamRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApproveDreamResponse:
    """
    Approves the reconstructed story version, advancing dream status to APPROVED.
    Ready for 3D world composition and director script generation.
    """
    repo = DreamRepository(db, current_user.id)
    dream = await repo.get_by_id(dream_id)
    if not dream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    version_id = payload.version_id
    if not version_id:
        latest = await repo.get_latest_version(dream_id)
        if not latest:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No story version exists to approve. Reconstruct the dream first.",
            )
        version_id = latest.id

    try:
        approved_version = await repo.approve_version(dream_id, version_id)
        return ApproveDreamResponse(
            status=DreamStatus.APPROVED.value,
            dream_id=dream_id,
            version_id=approved_version.id,
            message="Dream approved and ready for 3D world composition.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Approval failed: {exc!s}",
        ) from exc


@router.post("/{dream_id}/interpret", response_model=InterpretationResponse)
async def generate_or_get_interpretation(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InterpretationResponse:
    """
    Generates or retrieves 2-3 grounded psychological reflection threads for the dream.
    """
    repo = DreamRepository(db, current_user.id)
    dream = await repo.get_by_id(dream_id)
    if not dream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    try:
        interp = await run_interpretation_stage(db, dream_id=dream_id, user_id=current_user.id)
        return InterpretationResponse(
            id=interp.id,
            dream_id=interp.dream_id,
            threads=[InterpretationThread.model_validate(t) for t in interp.threads_json],
            selected_thread_index=interp.selected_thread_index,
            feedback=interp.feedback,
            feedback_note=interp.feedback_note,
            created_at=interp.created_at,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Interpretation generation failed: {exc!s}",
        ) from exc


@router.get("/{dream_id}/interpret", response_model=InterpretationResponse | None)
async def get_interpretation(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InterpretationResponse | None:
    """
    Gets the existing interpretation for a dream, or returns null if not generated yet.
    """
    from sqlalchemy import select

    repo = DreamRepository(db, current_user.id)
    dream = await repo.get_by_id(dream_id)
    if not dream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    stmt = (
        select(Interpretation)
        .where(Interpretation.dream_id == dream_id)
        .order_by(Interpretation.created_at.desc())
    )
    result = await db.execute(stmt)
    interp = result.scalars().first()
    if not interp:
        return None

    return InterpretationResponse(
        id=interp.id,
        dream_id=interp.dream_id,
        threads=[InterpretationThread.model_validate(t) for t in interp.threads_json],
        selected_thread_index=interp.selected_thread_index,
        feedback=interp.feedback,
        feedback_note=interp.feedback_note,
        created_at=interp.created_at,
    )


@router.post("/{dream_id}/interpret/feedback", response_model=InterpretationResponse)
async def submit_interpretation_feedback(
    dream_id: uuid.UUID,
    payload: InterpretationFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InterpretationResponse:
    """
    Stores user resonance feedback on reflection threads ('resonates' / 'felt_different')
    and prepares event for lexicon distribution updating.
    """
    from sqlalchemy import select

    repo = DreamRepository(db, current_user.id)
    dream = await repo.get_by_id(dream_id)
    if not dream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")

    stmt = (
        select(Interpretation)
        .where(Interpretation.dream_id == dream_id)
        .order_by(Interpretation.created_at.desc())
    )
    result = await db.execute(stmt)
    interp = result.scalars().first()
    if not interp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No interpretation exists for this dream yet.",
        )

    interp.feedback = payload.feedback
    interp.selected_thread_index = payload.selected_thread_index
    interp.feedback_note = payload.feedback_note

    await db.commit()
    await db.refresh(interp)

    return InterpretationResponse(
        id=interp.id,
        dream_id=interp.dream_id,
        threads=[InterpretationThread.model_validate(t) for t in interp.threads_json],
        selected_thread_index=interp.selected_thread_index,
        feedback=interp.feedback,
        feedback_note=interp.feedback_note,
        created_at=interp.created_at,
    )

