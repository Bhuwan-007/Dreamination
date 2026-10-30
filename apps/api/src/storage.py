"""
Audio and media asset storage service.
Supports local directory storage with fallback when MinIO is not connected.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from .config import settings
from .logging import logger

LOCAL_STORAGE_DIR = Path("data/storage/audio")


class StorageService:
    """Manages audio and media blob storage."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir = base_dir or LOCAL_STORAGE_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_audio(self, audio_bytes: bytes, original_filename: str = "dream.webm") -> str:
        """Saves raw audio file and returns a unique storage key."""
        ext = Path(original_filename).suffix or ".webm"
        file_id = f"{uuid.uuid4().hex}{ext}"
        target_path = self.base_dir / file_id

        with open(target_path, "wb") as f:
            f.write(audio_bytes)

        logger.info(f"Saved audio asset: {file_id} ({len(audio_bytes)} bytes)")
        return file_id

    def get_audio(self, storage_key: str) -> bytes | None:
        """Retrieves raw audio bytes by storage key."""
        # Sanitize path to prevent directory traversal
        clean_key = Path(storage_key).name
        target_path = self.base_dir / clean_key

        if not target_path.exists():
            return None

        with open(target_path, "rb") as f:
            return f.read()

    def generate_presigned_upload_url(self, filename: str) -> dict[str, str]:
        """
        Generates upload coordinates for the client.
        In local dev mode, points to the API's upload endpoint.
        """
        ext = Path(filename).suffix or ".webm"
        file_id = f"{uuid.uuid4().hex}{ext}"
        return {
            "upload_url": f"/api/dreams/upload-audio?key={file_id}",
            "storage_key": file_id,
        }


storage_service = StorageService()

