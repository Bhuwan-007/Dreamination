"""
Embedding providers for Personal Dream Graph (Phase 7).
Supports Gemini API embedding (text-embedding-004) with deterministic local fallback.
All output vectors are normalized unit vectors of dimension 1536.
"""

from __future__ import annotations

import hashlib
import math
import os
from typing import Protocol, runtime_checkable

import httpx

from ..config import settings

EMBEDDING_DIM = 1536


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Protocol for vector embedding providers."""

    async def embed_text(self, text: str) -> list[float]:
        """Embed a single text string into a normalized 1536-dim vector."""
        ...

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple text strings."""
        ...


def _normalize(vec: list[float]) -> list[float]:
    """Normalizes vector to unit length (L2 norm)."""
    norm = math.sqrt(sum(x * x for x in vec))
    if norm < 1e-12:
        return [1.0 / math.sqrt(len(vec))] * len(vec)
    return [x / norm for x in vec]


class DeterministicEmbeddingProvider:
    """
    Deterministic pseudo-semantic vector generator for testing and offline environments.
    Computes a 1536-dim unit vector from text tokens using cryptographic hashing + sinusoidal bases.
    Texts sharing tokens will naturally exhibit higher cosine similarity.
    """

    async def embed_text(self, text: str) -> list[float]:
        cleaned = text.strip().lower()
        if not cleaned:
            return _normalize([0.0] * EMBEDDING_DIM)

        vec = [0.0] * EMBEDDING_DIM
        words = cleaned.split()

        for w_idx, word in enumerate(words):
            h = hashlib.sha256(word.encode("utf-8")).digest()
            seed = int.from_bytes(h[:8], "big")
            for i in range(EMBEDDING_DIM):
                angle = (seed * (i + 1) + w_idx) % 100000 / 1000.0
                vec[i] += math.sin(angle) * (1.0 / math.sqrt(w_idx + 1))

        return _normalize(vec)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed_text(t) for t in texts]


class GeminiEmbeddingProvider:
    """Google Gemini text-embedding-004 via official REST API."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        self.fallback = DeterministicEmbeddingProvider()

    async def embed_text(self, text: str) -> list[float]:
        if not self.api_key:
            return await self.fallback.embed_text(text)

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
            f"?key={self.api_key}"
        )
        payload = {
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text[:2048]}]},
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    values = data.get("embedding", {}).get("values", [])
                    if values:
                        # text-embedding-004 outputs 768 dimensions; tile to 1536 to match DB schema
                        expanded = values + values if len(values) == 768 else values
                        if len(expanded) < EMBEDDING_DIM:
                            expanded += [0.0] * (EMBEDDING_DIM - len(expanded))
                        return _normalize(expanded[:EMBEDDING_DIM])
        except Exception:
            pass

        return await self.fallback.embed_text(text)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed_text(t) for t in texts]


def get_embedding_provider() -> EmbeddingProvider:
    """Returns active embedding provider based on environment and config."""
    if os.getenv("PYTEST_CURRENT_TEST") or settings.ENVIRONMENT == "test":
        return DeterministicEmbeddingProvider()

    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if api_key:
        return GeminiEmbeddingProvider(api_key=api_key)

    return DeterministicEmbeddingProvider()
