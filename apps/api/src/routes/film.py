"""
Film render routes (2.5D living-ink dream films).

POST /dreams/{id}/render          start (or restart) a render job; returns immediately
GET  /dreams/{id}/render/status   stage / progress / error of the latest job
GET  /dreams/{id}/manifest        the compiled FilmManifest for the dream's current story

Rendering runs in-process as a background task (no Redis/Celery needed on a free host).
Progress lives in a small in-memory registry and the RenderJob row; the manifest is a
file in storage. Every endpoint checks that the dream belongs to the caller.
"""

from __future__ import annotations

import json
import threading
import uuid
from typing import Any

from apps.worker.src.tasks.film_render import compile_film_manifest, film_manifest_path
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..config import settings
from ..database import get_db
from ..logging import logger
from ..models.dream import DreamStatus
from ..models.entity import DreamEntityLink, Entity
from ..models.render_job import CharacterSheet, RenderJob, RenderJobStatus
from ..models.user import User
from ..repositories.dream import DreamRepository
from ..stages.film_director import build_film_plan, enrich_film_plan, figure_record

router = APIRouter(prefix="/dreams", tags=["film"])

_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.Lock()


def _set_job(dream_id: str, **fields: Any) -> None:
    with _jobs_lock:
        _jobs.setdefault(dream_id, {}).update(fields)


def _get_job(dream_id: str) -> dict[str, Any] | None:
    with _jobs_lock:
        job = _jobs.get(dream_id)
        return dict(job) if job else None


async def _owned_dream_and_version(dream_id: uuid.UUID, user: User, db: AsyncSession):
    repo = DreamRepository(db, user.id)
    dream = await repo.get_by_id(dream_id)
    if not dream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dream not found.")
    version = await repo.get_approved_version(dream_id) or await repo.get_latest_version(dream_id)
    return dream, version


async def _run_film_job(dream_id: str, version_id: str, plan_dict: dict[str, Any], story: dict[str, Any]) -> None:
    from ..schemas.film import FilmPlan

    try:
        if settings.ENVIRONMENT != "test":
            _set_job(dream_id, stage="directing", progress=0.03)
            plan = await enrich_film_plan(FilmPlan.model_validate(plan_dict), story)
            plan_dict = plan.model_dump()

        def progress(stage: str, pct: float) -> None:
            _set_job(dream_id, stage=stage, progress=round(pct, 3))

        await run_in_threadpool(compile_film_manifest, dream_id, plan_dict, version_id, progress)
        _set_job(dream_id, status=RenderJobStatus.COMPLETED.value, stage="completed", progress=1.0, error=None)
    except Exception as exc:  # noqa: BLE001 - surface any failure to the status endpoint
        logger.error(f"Film render failed for a dream ({type(exc).__name__}).")
        _set_job(dream_id, status=RenderJobStatus.FAILED.value, stage="failed", error=f"{type(exc).__name__}: {exc}")


@router.post("/{dream_id}/render", status_code=status.HTTP_202_ACCEPTED)
async def start_film_render(
    dream_id: uuid.UUID,
    background: BackgroundTasks,
    style_id: str = "ink_wash",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    dream, version = await _owned_dream_and_version(dream_id, current_user, db)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reconstruct the dream before rendering its film.",
        )
    key = str(dream_id)
    running = _get_job(key)
    if running and running.get("status") == RenderJobStatus.PROCESSING.value:
        return {"status": "processing", "dream_id": key, **{k: running.get(k) for k in ("stage", "progress")}}

    # Characters: every person/creature linked to this dream, with the user's own words.
    rows = (
        await db.execute(
            select(Entity, DreamEntityLink.salience)
            .join(DreamEntityLink, Entity.id == DreamEntityLink.entity_id)
            .where(DreamEntityLink.dream_id == dream_id, Entity.user_id == current_user.id)
        )
    ).all()
    entities = [
        {"entity_id": str(e.id), "name": e.canonical_name, "type": e.type,
         "description": e.description or "", "salience": sal}
        for e, sal in rows
    ]

    # Recurring characters keep the figure they had in earlier dreams.
    entity_ids = [uuid.UUID(e["entity_id"]) for e in entities]
    sheets = (
        await db.execute(
            select(CharacterSheet).where(
                CharacterSheet.user_id == current_user.id, CharacterSheet.entity_id.in_(entity_ids)
            )
        )
    ).scalars().all() if entity_ids else []
    known: dict[str, dict[str, Any]] = {}
    for sheet in sheets:
        try:
            known[str(sheet.entity_id)] = json.loads(sheet.visual_description or "{}")
        except json.JSONDecodeError:
            continue

    story = version.story_json or {}
    plan = build_film_plan(story, entities, known, style_id=style_id, dream_mood=dream.mood_on_waking)

    for member in plan.cast:
        if member.entity_id and member.entity_id not in known:
            db.add(CharacterSheet(
                user_id=current_user.id,
                entity_id=uuid.UUID(member.entity_id),
                image_keys=[],
                visual_description=json.dumps(figure_record(member)),
            ))

    job = (await db.execute(select(RenderJob).where(RenderJob.dream_id == dream_id))).scalars().first()
    if not job:
        job = RenderJob(dream_id=dream_id)
        db.add(job)
    job.status = RenderJobStatus.PROCESSING.value
    job.progress = 0.0
    job.stage = "queued"
    job.error = None
    job.screenplay_json = plan.model_dump()
    dream.status = DreamStatus.RENDERING.value
    await db.commit()

    _set_job(key, status=RenderJobStatus.PROCESSING.value, stage="queued", progress=0.0, error=None,
             version_id=str(version.id))
    background.add_task(_run_film_job, key, str(version.id), plan.model_dump(), story)
    return {"status": "processing", "dream_id": key, "job_id": str(job.id), "stage": "queued", "progress": 0.0}


@router.get("/{dream_id}/render/status")
async def film_render_status(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    dream, version = await _owned_dream_and_version(dream_id, current_user, db)
    key = str(dream_id)
    live = _get_job(key)
    job = (await db.execute(select(RenderJob).where(RenderJob.dream_id == dream_id))).scalars().first()
    manifest_ready = film_manifest_path(key).exists()

    if live:
        state = live
        if job and live.get("status") in (RenderJobStatus.COMPLETED.value, RenderJobStatus.FAILED.value) \
                and job.status != live["status"]:
            job.status = live["status"]
            job.stage = live.get("stage")
            job.progress = float(live.get("progress") or 0.0)
            job.error = live.get("error")
            if live["status"] == RenderJobStatus.COMPLETED.value:
                dream.status = DreamStatus.RENDERED.value
            await db.commit()
    elif job:
        interrupted = job.status == RenderJobStatus.PROCESSING.value
        state = {
            "status": RenderJobStatus.FAILED.value if interrupted else job.status,
            "stage": "interrupted" if interrupted else job.stage,
            "progress": job.progress,
            "error": "The render was interrupted (server restarted). Start it again." if interrupted else job.error,
        }
    else:
        state = {"status": "not_started", "stage": None, "progress": 0.0, "error": None}

    return {
        "dream_id": key,
        "status": state.get("status"),
        "stage": state.get("stage"),
        "progress": state.get("progress", 0.0),
        "error": state.get("error"),
        "manifest_ready": manifest_ready,
        "current_version_id": str(version.id) if version else None,
    }


@router.get("/{dream_id}/manifest")
async def get_film_manifest(
    dream_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    _, version = await _owned_dream_and_version(dream_id, current_user, db)
    path = film_manifest_path(str(dream_id))
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This dream's film has not been rendered yet.")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["stale"] = bool(version and manifest.get("versionId") not in (None, str(version.id)))
    return manifest
