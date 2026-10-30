"""
Dream repository scoped strictly to user_id.
Handles application-layer encryption and decryption transparently.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import sqlalchemy as sa

from ..crypto import decrypt_field, encrypt_field
from ..models.dream import Dream, DreamStatus, DreamVersion
from ..models.entity import DreamEntityLink, Entity
from .base import BaseScopedRepository, RecordNotFoundError, ScopedAccessError


@dataclass
class DecryptedDream:
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


class DreamRepository(BaseScopedRepository[Dream]):
    """Scoped repository for Dream records with transparent field-level encryption."""

    model = Dream

    async def create_dream(
        self,
        raw_text: str | None = None,
        transcript: str | None = None,
        mood_on_waking: str | None = None,
        recent_life_context: str | None = None,
        raw_audio_key: str | None = None,
        status: str = DreamStatus.CAPTURED.value,
        captured_at: datetime | None = None,
    ) -> Dream:
        """
        Creates a new dream record, encrypting sensitive text columns at the application layer.
        """
        dream = Dream(
            user_id=self.user_id,
            raw_text_encrypted=encrypt_field(raw_text, self.user_id),
            transcript_encrypted=encrypt_field(transcript, self.user_id),
            recent_life_context_encrypted=encrypt_field(recent_life_context, self.user_id),
            raw_audio_key=raw_audio_key,
            mood_on_waking=mood_on_waking,
            status=status,
        )
        if captured_at:
            dream.captured_at = captured_at

        self.db.add(dream)
        await self.db.flush()
        return dream

    async def get_decrypted(self, dream_id: uuid.UUID) -> DecryptedDream | None:
        """
        Fetches the dream scoped to user_id and decrypts sensitive text fields.
        Returns None if not found or if owned by another user.
        """
        dream = await self.get_by_id(dream_id)
        if dream is None:
            return None

        return DecryptedDream(
            id=dream.id,
            user_id=dream.user_id,
            captured_at=dream.captured_at,
            raw_text=decrypt_field(dream.raw_text_encrypted, self.user_id),
            transcript=decrypt_field(dream.transcript_encrypted, self.user_id),
            mood_on_waking=dream.mood_on_waking,
            recent_life_context=decrypt_field(dream.recent_life_context_encrypted, self.user_id),
            raw_audio_key=dream.raw_audio_key,
            status=dream.status,
            created_at=dream.created_at,
            updated_at=dream.updated_at,
        )

    async def update_dream(
        self,
        dream_id: uuid.UUID,
        raw_text: str | None = None,
        transcript: str | None = None,
        mood_on_waking: str | None = None,
        recent_life_context: str | None = None,
        status: str | None = None,
    ) -> Dream | None:
        """
        Updates a dream record scoped to user_id, re-encrypting modified text fields.
        """
        dream = await self.get_by_id(dream_id)
        if dream is None:
            return None

        if raw_text is not None:
            dream.raw_text_encrypted = encrypt_field(raw_text, self.user_id)
        if transcript is not None:
            dream.transcript_encrypted = encrypt_field(transcript, self.user_id)
        if recent_life_context is not None:
            dream.recent_life_context_encrypted = encrypt_field(recent_life_context, self.user_id)
        if mood_on_waking is not None:
            dream.mood_on_waking = mood_on_waking
        if status is not None:
            dream.status = status

        await self.db.flush()
        return dream

    async def create_version(
        self,
        dream_id: uuid.UUID,
        mode: str,
        story_json: dict[str, Any],
        gap_fills_json: list[Any] | None = None,
        is_approved: bool = False,
    ) -> DreamVersion:
        """
        Creates a story version. Enforces that dream_id is owned by self.user_id.
        """
        dream = await self.get_by_id(dream_id)
        if dream is None:
            raise ScopedAccessError("Cannot create version for non-existent or foreign dream.")

        version = DreamVersion(
            dream_id=dream.id,
            mode=mode,
            story_json=story_json,
            gap_fills_json=gap_fills_json,
            is_approved=is_approved,
        )
        self.db.add(version)
        await self.db.flush()
        return version

    async def list_versions(self, dream_id: uuid.UUID) -> list[DreamVersion]:
        """Lists versions for a dream, enforcing ownership."""
        dream = await self.get_by_id(dream_id)
        if dream is None:
            raise RecordNotFoundError("Dream not found")

        stmt = (
            sa.select(DreamVersion)
            .where(DreamVersion.dream_id == dream.id)
            .order_by(DreamVersion.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_version(self, version_id: uuid.UUID) -> DreamVersion | None:
        """Fetches a version ensuring its parent dream belongs to self.user_id."""
        stmt = (
            sa.select(DreamVersion)
            .join(Dream, DreamVersion.dream_id == Dream.id)
            .where(
                DreamVersion.id == version_id,
                Dream.user_id == self.user_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_latest_version(
        self,
        dream_id: uuid.UUID,
        mode: str | None = None,
    ) -> DreamVersion | None:
        """Fetches the latest version for a dream, optionally filtered by mode."""
        dream = await self.get_by_id(dream_id)
        if dream is None:
            return None

        stmt = sa.select(DreamVersion).where(DreamVersion.dream_id == dream.id)
        if mode:
            stmt = stmt.where(DreamVersion.mode == mode)
        stmt = stmt.order_by(DreamVersion.created_at.desc())

        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update_version(
        self,
        version_id: uuid.UUID,
        story_json: dict[str, Any] | None = None,
        gap_fills_json: list[Any] | None = None,
        is_approved: bool | None = None,
    ) -> DreamVersion | None:
        """Updates a version after verifying user ownership."""
        version = await self.get_version(version_id)
        if version is None:
            return None

        if story_json is not None:
            version.story_json = story_json
        if gap_fills_json is not None:
            version.gap_fills_json = gap_fills_json
        if is_approved is not None:
            version.is_approved = is_approved

        await self.db.flush()
        return version

    async def approve_version(
        self,
        dream_id: uuid.UUID,
        version_id: uuid.UUID,
    ) -> DreamVersion:
        """
        Approves a specific version for a dream, unapproving previous versions
        and advancing dream status to APPROVED.
        """
        dream = await self.get_by_id(dream_id)
        if dream is None:
            raise ScopedAccessError("Dream does not exist or belongs to another user.")

        target_version = await self.get_version(version_id)
        if target_version is None or target_version.dream_id != dream.id:
            raise ScopedAccessError("Version does not belong to this dream or user.")

        # Unapprove all versions for this dream
        unapprove_stmt = (
            sa.update(DreamVersion)
            .where(DreamVersion.dream_id == dream.id)
            .values(is_approved=False)
        )
        await self.db.execute(unapprove_stmt)

        # Mark target approved
        target_version.is_approved = True
        dream.status = DreamStatus.APPROVED.value
        await self.db.flush()
        return target_version

    async def link_entity(
        self,
        dream_id: uuid.UUID,
        entity_id: uuid.UUID,
        role: str | None = None,
        salience: float = 1.0,
        emotion_valence: float = 0.0,
    ) -> DreamEntityLink:
        """
        Links an entity to a dream. Enforces that both the dream and entity belong to self.user_id.
        """
        dream = await self.get_by_id(dream_id)
        if dream is None:
            raise ScopedAccessError("Dream does not exist or belongs to another user.")

        # Verify entity ownership
        entity_stmt = sa.select(Entity).where(
            Entity.id == entity_id,
            Entity.user_id == self.user_id,
        )
        entity_res = await self.db.execute(entity_stmt)
        if entity_res.scalars().first() is None:
            raise ScopedAccessError("Entity does not exist or belongs to another user.")

        link = DreamEntityLink(
            dream_id=dream.id,
            entity_id=entity_id,
            role=role,
            salience=salience,
            emotion_valence=emotion_valence,
        )
        self.db.add(link)
        await self.db.flush()
        return link

    async def list_linked_entities(self, dream_id: uuid.UUID) -> list[tuple[DreamEntityLink, Entity]]:
        """
        Retrieves all entities linked to a dream, verifying ownership.
        """
        dream = await self.get_by_id(dream_id)
        if dream is None:
            raise RecordNotFoundError("Dream not found")

        stmt = (
            sa.select(DreamEntityLink, Entity)
            .join(Entity, DreamEntityLink.entity_id == Entity.id)
            .where(
                DreamEntityLink.dream_id == dream.id,
                Entity.user_id == self.user_id,
            )
        )
        result = await self.db.execute(stmt)
        return list(result.all())

