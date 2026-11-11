"""
Single source of truth for where rendered assets live on disk.

DREAM_STORAGE_DIR overrides the default (data/storage, relative to the process CWD).
The test suite points it at a temporary directory so test runs never write into the
developer's real storage.
"""

from __future__ import annotations

import os
from pathlib import Path


def storage_root() -> Path:
    root = Path(os.getenv("DREAM_STORAGE_DIR", "data/storage"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def storage_dir(name: str) -> Path:
    path = storage_root() / name
    path.mkdir(parents=True, exist_ok=True)
    return path
