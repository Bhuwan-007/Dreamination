"""
AI and Model Provider Interfaces for The Dream Machine.
Supports Gemini Free -> Local Ollama (llama3.1:8b) ladder.
"""

from .embeddings import (
    DeterministicEmbeddingProvider,
    EmbeddingProvider,
    GeminiEmbeddingProvider,
    get_embedding_provider,
)
from .llm import GeminiProvider, LLMProvider, OllamaProvider, complete_json, get_llm_provider

__all__ = [
    "LLMProvider",
    "OllamaProvider",
    "GeminiProvider",
    "get_llm_provider",
    "complete_json",
    "EmbeddingProvider",
    "DeterministicEmbeddingProvider",
    "GeminiEmbeddingProvider",
    "get_embedding_provider",
]
