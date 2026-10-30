"""
Pydantic schemas for The Dream Machine pipeline stages.
"""

from .extraction import (
    DreamFragment,
    ExtractedEmotion,
    ExtractedEntity,
    ExtractedTransition,
    ExtractionOutput,
)
from .reconstruction import (
    ApproveDreamRequest,
    ApproveDreamResponse,
    BeatItem,
    DialogueItem,
    DreamVersionResponse,
    ReconstructDreamRequest,
    ReconstructedScene,
    ReconstructionOutput,
    SceneRepairRequest,
    SceneUpdateRequest,
)

__all__ = [
    "ApproveDreamRequest",
    "ApproveDreamResponse",
    "BeatItem",
    "DialogueItem",
    "DreamFragment",
    "DreamVersionResponse",
    "ExtractedEmotion",
    "ExtractedEntity",
    "ExtractedTransition",
    "ExtractionOutput",
    "ReconstructDreamRequest",
    "ReconstructedScene",
    "ReconstructionOutput",
    "SceneRepairRequest",
    "SceneUpdateRequest",
]

