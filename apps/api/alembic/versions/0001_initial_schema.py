"""Initial database schema with pgvector and field-level encryption

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-30 20:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 0. Enable pgvector extension if on PostgreSQL
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector;"))

    # 1. users table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("style_bible_id", sa.Uuid(as_uuid=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 2. style_bibles table
    op.create_table(
        "style_bibles",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("style_name", sa.String(100), nullable=False),
        sa.Column("style_prompt", sa.Text(), nullable=False),
        sa.Column("negative_prompt", sa.Text(), nullable=True),
        sa.Column("reference_image_keys", sa.JSON(), nullable=False),
        sa.Column("palette", sa.JSON(), nullable=False),
        sa.Column("locked", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_style_bibles_user_id", "style_bibles", ["user_id"])

    # Add foreign key from users.style_bible_id -> style_bibles.id
    op.create_foreign_key("fk_user_style_bible", "users", "style_bibles", ["style_bible_id"], ["id"], ondelete="SET NULL")

    # 3. dreams table
    op.create_table(
        "dreams",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_text_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("raw_audio_key", sa.String(255), nullable=True),
        sa.Column("transcript_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("mood_on_waking", sa.String(50), nullable=True),
        sa.Column("recent_life_context_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("status", sa.String(32), default="captured", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dreams_user_id", "dreams", ["user_id"])
    op.create_index("ix_dreams_status", "dreams", ["status"])

    # 4. dream_versions table
    op.create_table(
        "dream_versions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("dream_id", sa.Uuid(as_uuid=True), sa.ForeignKey("dreams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", sa.String(32), default="faithful", nullable=False),
        sa.Column("story_json", sa.JSON(), nullable=False),
        sa.Column("gap_fills_json", sa.JSON(), nullable=True),
        sa.Column("is_approved", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dream_versions_dream_id", "dream_versions", ["dream_id"])

    # 5. character_sheets table
    op.create_table(
        "character_sheets",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),  # FK added after entities table created
        sa.Column("image_keys", sa.JSON(), nullable=True),
        sa.Column("visual_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_character_sheets_user_id", "character_sheets", ["user_id"])

    # 6. entities table
    op.create_table(
        "entities",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("canonical_name", sa.String(255), nullable=False),
        sa.Column("aliases", sa.JSON(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("first_seen_dream_id", sa.Uuid(as_uuid=True), sa.ForeignKey("dreams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("character_sheet_id", sa.Uuid(as_uuid=True), sa.ForeignKey("character_sheets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_entities_user_id", "entities", ["user_id"])
    op.create_index("ix_entities_canonical_name", "entities", ["canonical_name"])
    op.create_index("ix_entities_type", "entities", ["type"])

    # Wire character_sheets.entity_id foreign key to entities.id
    op.create_foreign_key("fk_character_sheets_entity_id", "character_sheets", "entities", ["entity_id"], ["id"], ondelete="CASCADE")

    # 7. dream_entity_links table
    op.create_table(
        "dream_entity_links",
        sa.Column("dream_id", sa.Uuid(as_uuid=True), sa.ForeignKey("dreams.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), sa.ForeignKey("entities.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(100), nullable=True),
        sa.Column("salience", sa.Float(), default=1.0, nullable=False),
        sa.Column("emotion_valence", sa.Float(), default=0.0, nullable=False),
    )

    # 8. entity_edges table
    op.create_table(
        "entity_edges",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_entity_id", sa.Uuid(as_uuid=True), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_entity_id", sa.Uuid(as_uuid=True), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relation_type", sa.String(100), nullable=False),
        sa.Column("weight", sa.Float(), default=1.0, nullable=False),
        sa.Column("evidence_dream_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_entity_edges_user_id", "entity_edges", ["user_id"])
    op.create_index("ix_entity_edges_source", "entity_edges", ["source_entity_id"])
    op.create_index("ix_entity_edges_target", "entity_edges", ["target_entity_id"])

    # 9. symbol_meanings table
    op.create_table(
        "symbol_meanings",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), sa.ForeignKey("entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("meaning_label", sa.String(255), nullable=False),
        sa.Column("probability", sa.Float(), default=0.0, nullable=False),
        sa.Column("evidence_count", sa.Integer(), default=1, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_symbol_meanings_user_id", "symbol_meanings", ["user_id"])
    op.create_index("ix_symbol_meanings_entity_id", "symbol_meanings", ["entity_id"])

    # 10. interpretations table
    op.create_table(
        "interpretations",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("dream_id", sa.Uuid(as_uuid=True), sa.ForeignKey("dreams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("threads_json", sa.JSON(), nullable=False),
        sa.Column("selected_thread_index", sa.Integer(), nullable=True),
        sa.Column("feedback", sa.String(32), default="none", nullable=False),
        sa.Column("feedback_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_interpretations_dream_id", "interpretations", ["dream_id"])

    # 11. dream_embeddings table
    op.create_table(
        "dream_embeddings",
        sa.Column("dream_id", sa.Uuid(as_uuid=True), sa.ForeignKey("dreams.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("summary_embedding", Vector(1536), nullable=True),
        sa.Column("emotion_embedding", Vector(1536), nullable=True),
    )

    # 12. render_jobs table
    op.create_table(
        "render_jobs",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("dream_id", sa.Uuid(as_uuid=True), sa.ForeignKey("dreams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), default="pending", nullable=False),
        sa.Column("progress", sa.Float(), default=0.0, nullable=False),
        sa.Column("stage", sa.String(100), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("output_video_key", sa.String(255), nullable=True),
        sa.Column("screenplay_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_render_jobs_dream_id", "render_jobs", ["dream_id"])
    op.create_index("ix_render_jobs_status", "render_jobs", ["status"])

    # 13. audit_log table (STRICT PRIVACY: never contains dream text or content)
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])

    # 14. Vector HNSW indexes (PostgreSQL specific)
    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS idx_entities_embedding_hnsw "
                "ON entities USING hnsw (embedding vector_cosine_ops);"
            )
        )
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS idx_dream_embeddings_summary_hnsw "
                "ON dream_embeddings USING hnsw (summary_embedding vector_cosine_ops);"
            )
        )
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS idx_dream_embeddings_emotion_hnsw "
                "ON dream_embeddings USING hnsw (emotion_embedding vector_cosine_ops);"
            )
        )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("render_jobs")
    op.drop_table("dream_embeddings")
    op.drop_table("interpretations")
    op.drop_table("symbol_meanings")
    op.drop_table("entity_edges")
    op.drop_table("dream_entity_links")
    op.drop_table("entities")
    op.drop_table("character_sheets")
    op.drop_table("dream_versions")
    op.drop_table("dreams")
    op.drop_constraint("fk_user_style_bible", "users", type_="foreignkey")
    op.drop_table("style_bibles")
    op.drop_table("users")

