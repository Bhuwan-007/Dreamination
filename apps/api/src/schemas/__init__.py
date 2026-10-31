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
from .interpretation import (
    EvidenceItem,
    InterpretationFeedbackRequest,
    InterpretationOutput,
    InterpretationResponse,
    InterpretationThread,
    InterpretedSymbol,
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
    "EvidenceItem",
    "ExtractedEmotion",
    "ExtractedEntity",
    "ExtractedTransition",
    "ExtractionOutput",
    "InterpretationFeedbackRequest",
    "InterpretationOutput",
    "InterpretationResponse",
    "InterpretationThread",
    "InterpretedSymbol",
    "ReconstructDreamRequest",
    "ReconstructedScene",
    "ReconstructionOutput",
    "SceneRepairRequest",
    "SceneUpdateRequest",
]

