"""
Multi-Tenant Isolation and Repository Scoping Tests.
Proves that User A can NEVER access, modify, query, or delete User B's data under any method call.
Enforces Field-Level Encryption on dream text columns at rest in the database.
"""

import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.crypto import hash_password
from apps.api.src.models.dream import Dream, DreamStatus
from apps.api.src.models.entity import Entity, EntityType
from apps.api.src.repositories.base import RecordNotFoundError, ScopedAccessError
from apps.api.src.repositories.dream import DreamRepository
from apps.api.src.repositories.entity import EntityRepository
from apps.api.src.repositories.user import UserRepository

pytestmark = pytest.mark.anyio


async def _create_test_users(db: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    repo = UserRepository(db)
    user_a = await repo.create_user(
        email=f"alice_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("Password123!"),
    )
    user_b = await repo.create_user(
        email=f"bob_{uuid.uuid4().hex[:6]}@example.com",
        password_hash=hash_password("Password123!"),
    )
    await db.commit()
    return user_a.id, user_b.id


async def test_dream_field_level_encryption_at_rest(db_session: AsyncSession):
    user_a_id, _ = await _create_test_users(db_session)
    repo_a = DreamRepository(db_session, user_a_id)

    raw_secret_text = "I opened a locker and seawater spilled out endlessly."
    transcript_text = "Seawater... endless seawater from the third locker."

    dream = await repo_a.create_dream(
        raw_text=raw_secret_text,
        transcript=transcript_text,
        mood_on_waking="disoriented",
    )
    await db_session.commit()

    # Verify at-rest storage in database contains encrypted bytes, NOT plaintext
    assert isinstance(dream.raw_text_encrypted, bytes)
    assert raw_secret_text.encode("utf-8") not in dream.raw_text_encrypted
    assert transcript_text.encode("utf-8") not in dream.transcript_encrypted

    # User A decrypts successfully
    decrypted = await repo_a.get_decrypted(dream.id)
    assert decrypted is not None
    assert decrypted.raw_text == raw_secret_text
    assert decrypted.transcript == transcript_text
    assert decrypted.mood_on_waking == "disoriented"


async def test_dream_read_isolation(db_session: AsyncSession):
    user_a_id, user_b_id = await _create_test_users(db_session)
    repo_a = DreamRepository(db_session, user_a_id)
    repo_b = DreamRepository(db_session, user_b_id)

    dream_a = await repo_a.create_dream(
        raw_text="Alice's private dream inside a glass dome.",
        mood_on_waking="serene",
    )
    await db_session.commit()

    # User B cannot get dream A by ID
    assert await repo_b.get_by_id(dream_a.id) is None
    assert await repo_b.get_decrypted(dream_a.id) is None

    # User B's list does not contain dream A
    b_dreams = await repo_b.list()
    assert len(b_dreams) == 0
    assert await repo_b.count() == 0

    # User B attempting get_or_raise gets RecordNotFoundError (no info leakage)
    with pytest.raises(RecordNotFoundError):
        await repo_b.get_or_raise(dream_a.id)


async def test_dream_update_and_delete_isolation(db_session: AsyncSession):
    user_a_id, user_b_id = await _create_test_users(db_session)
    repo_a = DreamRepository(db_session, user_a_id)
    repo_b = DreamRepository(db_session, user_b_id)

    dream_a = await repo_a.create_dream(raw_text="Original dream", mood_on_waking="calm")
    await db_session.commit()

    # User B attempts to tamper with User A's dream
    update_res = await repo_b.update_dream(dream_a.id, mood_on_waking="tampered")
    assert update_res is None

    # Verify User A's dream was NOT modified
    decrypted_a = await repo_a.get_decrypted(dream_a.id)
    assert decrypted_a is not None
    assert decrypted_a.mood_on_waking == "calm"

    # User B attempts to delete User A's dream
    delete_res = await repo_b.delete(dream_a.id)
    assert delete_res is False

    # Verify dream still exists for User A
    assert await repo_a.get_by_id(dream_a.id) is not None


async def test_dream_version_isolation(db_session: AsyncSession):
    user_a_id, user_b_id = await _create_test_users(db_session)
    repo_a = DreamRepository(db_session, user_a_id)
    repo_b = DreamRepository(db_session, user_b_id)

    dream_a = await repo_a.create_dream(raw_text="Story dream")
    await db_session.commit()

    # User B cannot create a story version on User A's dream
    with pytest.raises(ScopedAccessError):
        await repo_b.create_version(
            dream_id=dream_a.id,
            mode="faithful",
            story_json={"scenes": []},
        )

    # User A creates a story version
    version_a = await repo_a.create_version(
        dream_id=dream_a.id,
        mode="faithful",
        story_json={"scenes": [{"title": "Scene 1"}]},
    )
    await db_session.commit()
    assert version_a.id is not None

    # User B cannot list versions for User A's dream
    with pytest.raises(RecordNotFoundError):
        await repo_b.list_versions(dream_a.id)


async def test_entity_and_edge_isolation(db_session: AsyncSession):
    user_a_id, user_b_id = await _create_test_users(db_session)
    repo_a = EntityRepository(db_session, user_a_id)
    repo_b = EntityRepository(db_session, user_b_id)

    # Both create an entity with identical name "The Clock Tower"
    entity_a = await repo_a.create_entity(
        canonical_name="The Clock Tower",
        type=EntityType.PLACE.value,
        description="Alice's version with Roman numerals",
    )
    entity_b = await repo_b.create_entity(
        canonical_name="The Clock Tower",
        type=EntityType.PLACE.value,
        description="Bob's version with digital red numerals",
    )
    await db_session.commit()

    # Ensure separate records created
    assert entity_a.id != entity_b.id

    # Querying by name returns only the user's own entity
    found_a = await repo_a.get_by_name("The Clock Tower")
    assert found_a is not None
    assert found_a.description == "Alice's version with Roman numerals"

    found_b = await repo_b.get_by_name("The Clock Tower")
    assert found_b is not None
    assert found_b.description == "Bob's version with digital red numerals"

    # User B cannot connect an edge using User A's entity
    with pytest.raises(ScopedAccessError):
        await repo_b.create_edge(
            source_entity_id=entity_a.id,
            target_entity_id=entity_b.id,
            relation_type="located_in",
        )


async def test_symbol_meaning_isolation(db_session: AsyncSession):
    user_a_id, user_b_id = await _create_test_users(db_session)
    entity_repo_a = EntityRepository(db_session, user_a_id)
    entity_repo_b = EntityRepository(db_session, user_b_id)

    entity_a = await entity_repo_a.create_entity(canonical_name="White Wolf", type=EntityType.CREATURE.value)
    await db_session.commit()

    # User A assigns meaning "Loyalty" (0.85)
    meaning_a = await entity_repo_a.update_symbol_meaning(
        entity_id=entity_a.id,
        meaning_label="Loyalty",
        probability=0.85,
        evidence_count=3,
    )
    await db_session.commit()
    assert meaning_a.probability == 0.85

    # User B cannot see User A's symbol meanings
    b_meanings = await entity_repo_b.list_symbol_meanings()
    assert len(b_meanings) == 0

    # User B cannot update meaning for User A's entity
    with pytest.raises(ScopedAccessError):
        await entity_repo_b.update_symbol_meaning(
            entity_id=entity_a.id,
            meaning_label="Danger",
            probability=0.9,
        )


async def test_hard_delete_user_and_all_data_cascade(db_session: AsyncSession):
    user_a_id, user_b_id = await _create_test_users(db_session)
    dream_repo_a = DreamRepository(db_session, user_a_id)
    dream_repo_b = DreamRepository(db_session, user_b_id)
    entity_repo_a = EntityRepository(db_session, user_a_id)
    user_repo = UserRepository(db_session)

    # Populate User A with dream, version, entity, edge, meaning
    dream_a = await dream_repo_a.create_dream(raw_text="Alice's dream before account deletion")
    await dream_repo_a.create_version(dream_id=dream_a.id, mode="faithful", story_json={})
    entity_a = await entity_repo_a.create_entity(canonical_name="Mirror", type=EntityType.OBJECT.value)
    await entity_repo_a.update_symbol_meaning(entity_id=entity_a.id, meaning_label="Self-reflection", probability=0.7)

    # Populate User B with a dream
    dream_b = await dream_repo_b.create_dream(raw_text="Bob's dream that should remain safe")
    await db_session.commit()

    # Execute hard-delete on User A
    deleted = await user_repo.hard_delete_user_and_all_data(user_a_id)
    await db_session.commit()
    assert deleted is True

    # Confirm User A account is gone
    assert await user_repo.get_by_id(user_a_id) is None

    # Confirm User A's dreams and entities are purged
    assert await dream_repo_a.get_by_id(dream_a.id) is None
    assert await entity_repo_a.get_by_id(entity_a.id) is None

    # Confirm User B's dream remains intact and accessible
    assert await dream_repo_b.get_by_id(dream_b.id) is not None
    decrypted_b = await dream_repo_b.get_decrypted(dream_b.id)
    assert decrypted_b is not None
    assert decrypted_b.raw_text == "Bob's dream that should remain safe"

